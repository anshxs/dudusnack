const express = require("express");
const os = require("os");
const path = require("path");
const fs = require("fs").promises;
const net = require("net");
const { spawn, execFile } = require("child_process");
const { promisify } = require("util");

const app = express();
const execFileAsync = promisify(execFile);
const serviceDir = __dirname;
// Share this folder with files-server so Metro serves the files the editor saves.
const sessionsDir = path.join(serviceDir, "..", "files-server", "sessions");
let emulatorProcess = null;
let scrcpyProcess = null;
let expoProcess = null;
let deviceSerial = null;
let activeSessionId = null;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// Function to get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function run(command, args, options = {}) {
  return execFileAsync(command, args, { ...options, timeout: options.timeout || 15000 });
}

function waitForPort(port, child, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let retryTimer;
    const cleanup = () => {
      clearTimeout(retryTimer);
      child?.removeListener("close", onClose);
    };
    const onClose = (code) => {
      cleanup();
      reject(new Error(`ws-scrcpy exited before opening port ${port} (code ${code})`));
    };
    child?.once("close", onClose);
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        cleanup();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          cleanup();
          return reject(new Error(`ws-scrcpy did not listen on port ${port} within ${timeoutMs / 1000}s`));
        }
        retryTimer = setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

function createStreamUrl(req, serial) {
  const host = req.get("host")?.split(":")[0] || "127.0.0.1";
  const protocol = req.get("x-forwarded-proto") === "https" ? "wss" : "ws";
  const scrcpyWs = `${protocol}://${host}:8000/?action=proxy-adb&remote=tcp%3A8886&udid=${encodeURIComponent(serial)}`;
  return `${protocol === "wss" ? "https" : "http"}://${host}:8000/#!action=stream&udid=${encodeURIComponent(serial)}&player=mse&ws=${encodeURIComponent(scrcpyWs)}`;
}
// http://localhost:8000/#!action=stream&udid=emulator-5554&player=mse&ws=ws%3A%2F%2Flocalhost%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3Demulator-5554
async function ensureScrcpy() {
  if (!scrcpyProcess || scrcpyProcess.killed) {
    // Use Node 18 if it is installed, otherwise stay on the service's active
    // Node. RemoteShell loads node-pty only on demand, so screen streaming does
    // not depend on a native addon compiled for a particular Node ABI.
    const scrcpyStartCommand = 'if [ -s "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; nvm use 18 >/dev/null 2>&1 || true; fi; npm start';
    scrcpyProcess = spawn("bash", ["-lc", scrcpyStartCommand], {
      cwd: path.join(serviceDir, "ws-scrcpy"),
      stdio: "inherit",
    });
    scrcpyProcess.on("error", (error) => console.error("[SCRCPY] Failed to start:", error.message));
    scrcpyProcess.on("close", (code, signal) => {
      console.log(`[SCRCPY] Closed with code ${code}${signal ? ` (signal ${signal})` : ""}`);
      scrcpyProcess = null;
    });
    scrcpyProcess.on("exit", (code, signal) => {
      if (code !== 0) {
        console.error(`[SCRCPY] Exited unexpectedly with code ${code}${signal ? ` (signal ${signal})` : ""}`);
      }
    });
  }
  await waitForPort(8000, scrcpyProcess);
}

function runLogged(command, args, { label, cwd, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const displayCommand = [command, ...args].join(" ");
    console.log(`[${label}] $ ${displayCommand}`);
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = timeout && setTimeout(() => child.kill("SIGTERM"), timeout);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[${label}] ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[${label}] ${text}`);
    });
    child.once("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${displayCommand} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

async function getEmulators() {
  const { stdout } = await run("emulator", ["-list-avds"]);
  return stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
}

async function getBootedEmulatorSerial(avdName, timeoutMs = 120000) {
  // Treat missing values and the string "undefined" as no requested AVD.
  avdName = typeof avdName === "string" && avdName.trim() && avdName !== "undefined"
    ? avdName.trim()
    : null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { stdout } = await run("adb", ["devices"]);
    const serials = stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter(([, state]) => state === "device")
      .map(([serial]) => serial)
      .filter((serial) => /^emulator-\d+$/.test(serial));

    if (!avdName && serials.length) return serials[0];

    for (const serial of serials) {
      try {
        const { stdout: avd } = await run("adb", ["-s", serial, "emu", "avd", "name"]);
        if (avd.split(/\r?\n/)[0].trim() === avdName) return serial;
      } catch (error) {
        // The emulator may still be starting; retry until the deadline.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(avdName
    ? `Timed out waiting for emulator '${avdName}' to boot. Start it with POST /start and send { "emulatorName": "${avdName}" }.`
    : "No booted emulator found. Start one with POST /start first.");
}

async function getOnlineEmulatorSerial() {
  const { stdout } = await run("adb", ["devices"]);
  const serial = stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .find(([name, state]) => /^emulator-\d+$/.test(name) && state === "device")?.[0];
  if (!serial) throw new Error("No booted emulator is connected to ADB. Start the emulator, wait for boot to finish, then retry.");
  return serial;
}

function waitForExpoReady(expoProcess, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Expo/Metro to start")), timeoutMs);

    const onData = (chunk, source) => {
      const text = chunk.toString();
      output += text;
      console.log(`[EXPO:${source}] ${text}`);
      if (/Metro waiting on|exp:\/\/|http:\/\/localhost:8081|http:\/\/127\.0\.0\.1:8081/i.test(output)) {
        clearTimeout(timeout);
        expoProcess.stdout.removeListener("data", onStdout);
        expoProcess.stderr.removeListener("data", onStderr);
        resolve();
      }
    };

    const onStdout = (chunk) => onData(chunk, "OUT");
    const onStderr = (chunk) => onData(chunk, "ERR");
    expoProcess.stdout.on("data", onStdout);
    expoProcess.stderr.on("data", onStderr);
    expoProcess.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    expoProcess.once("close", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Expo process exited before Metro was ready (code ${code})`));
    });
  });
}

// Fetch available emulators
app.get("/emulators", async (_req, res) => {
  try {
    res.json({ emulators: await getEmulators() });
  } catch (error) {
    console.error("[ERROR] Failed to list emulators:", error.message);
    res.status(500).json({ error: "Failed to list emulators", details: error.message });
  }
});

app.get("/projects", async (_req, res) => {
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const projects = await Promise.all(entries
      .filter((entry) => entry.isDirectory() && /^[a-zA-Z0-9_-]+$/.test(entry.name))
      .map(async (entry) => {
        const sessionId = entry.name;
        const appPath = path.join(sessionsDir, sessionId, "app");
        try {
          const [packageJson, appConfig, stats] = await Promise.all([
            fs.readFile(path.join(appPath, "package.json"), "utf8").then(JSON.parse),
            fs.readFile(path.join(appPath, "app.json"), "utf8").then(JSON.parse).catch(() => ({})),
            fs.stat(appPath),
          ]);
          return {
            sessionId,
            projectName: appConfig.expo?.name || packageJson.name || sessionId,
            updatedAt: stats.mtime.toISOString(),
          };
        } catch {
          return null;
        }
      }));
    res.json({ projects: projects.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch (error) {
    res.status(error.code === "ENOENT" ? 200 : 500).json({
      projects: [],
      ...(error.code === "ENOENT" ? {} : { error: "Could not list projects", details: error.message }),
    });
  }
});

app.post("/start", async (req, res) => {
  const { emulatorName, sessionId } = req.body || {};
  if (!emulatorName || typeof emulatorName !== "string") {
    return res.status(400).json({ error: "emulatorName is required" });
  }
  if (!sessionId || typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: "A valid sessionId is required" });
  }

  try {
    const emulators = await getEmulators();
    if (!emulators.includes(emulatorName)) {
      return res.status(400).json({ error: `Unknown emulator '${emulatorName}'`, emulators });
    }
    if (emulatorProcess && activeSessionId === sessionId) {
      return res.status(202).json({ message: `Emulator '${emulatorName}' is already starting or running`, emulatorName });
    }

    console.log(`[INFO] Starting emulator: ${emulatorName}`);
    activeSessionId = sessionId;
    emulatorProcess = spawn("emulator", ["-avd", emulatorName, "-netdelay", "none", "-netspeed", "full"], {
      stdio: "inherit",
    });
    emulatorProcess.on("error", (error) => console.error("[EMULATOR]", error.message));
    emulatorProcess.on("close", (code) => {
      console.log(`[EMULATOR] Closed with code ${code}`);
      emulatorProcess = null;
      deviceSerial = null;
      if (activeSessionId === sessionId) activeSessionId = null;
    });
    res.status(202).json({ message: `Emulator '${emulatorName}' is starting`, emulatorName });
  } catch (error) {
    console.error("[ERROR] Failed to start emulator:", error.message);
    res.status(500).json({ error: "Failed to start emulator", details: error.message });
  }
});

// Return a stream as soon as the emulator has finished booting, without
// starting Metro or installing/opening the Expo project.
app.get("/stream", async (req, res) => {
  const { sessionId, emulatorName } = req.query;
  if (!sessionId || typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: "A valid sessionId is required" });
  }
  if (activeSessionId && activeSessionId !== sessionId) {
    return res.status(409).json({ error: "The active emulator belongs to a different session" });
  }
  if (activeSessionId !== sessionId) {
    return res.status(409).json({ error: "Start the emulator before requesting its screen" });
  }
  try {
    deviceSerial = await getBootedEmulatorSerial(typeof emulatorName === "string" ? emulatorName : undefined, 120000);
    await ensureScrcpy();
    res.json({ deviceSerial, streamUrl: createStreamUrl(req, deviceSerial) });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/create-expo", async (req, res) => {
  const { sessionId, projectName } = req.body || {};
  const id = sessionId;
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: "sessionId may contain only letters, numbers, underscores, and hyphens" });
  }

  const appPath = path.join(sessionsDir, id, "app");
  try {
    if (typeof projectName !== "string" || !projectName.trim()) {
      return res.status(400).json({ error: "projectName is required" });
    }
    await run("mkdir", ["-p", path.dirname(appPath)]);
    console.log(`[INFO] Creating latest Expo app for session ${id}: ${appPath}`);
    await runLogged("npx", ["--yes", "create-expo-app@latest", appPath, "--yes"], {
      label: `CREATE-EXPO:${id}`,
      cwd: serviceDir,
      timeout: 300000,
    });

    const packagePath = path.join(appPath, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
    packageJson.name = projectName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "expo-project";
    await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    const appConfigPath = path.join(appPath, "app.json");
    try {
      const appConfig = JSON.parse(await fs.readFile(appConfigPath, "utf8"));
      appConfig.expo = { ...appConfig.expo, name: projectName.trim(), slug: packageJson.name };
      await fs.writeFile(appConfigPath, `${JSON.stringify(appConfig, null, 2)}\n`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    res.status(201).json({ message: "Latest Expo project created", sessionId: id, projectName: projectName.trim(), projectPath: appPath });
  } catch (error) {
    console.error(`[ERROR] Failed to create Expo session ${id}:`, error.message);
    res.status(500).json({ error: "Failed to create Expo app", details: error.message, sessionId: id });
  }
});

app.post("/run-expo", async (req, res) => {
  const { sessionId, emulatorName } = req.body || {};
  if (!sessionId || typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: "A valid sessionId is required" });
  }
  const appPath = path.join(sessionsDir, sessionId, "app");
  try {
    await fs.access(path.join(appPath, "package.json"));
    if (expoProcess && !expoProcess.killed) expoProcess.kill("SIGTERM");
    const connectedDevice = activeSessionId === sessionId ? deviceSerial : null;
    activeSessionId = sessionId;
    deviceSerial = connectedDevice || await getBootedEmulatorSerial(emulatorName);
    await ensureScrcpy();
    expoProcess = spawn("npx", ["expo", "start", "--lan", "--clear"], {
      cwd: appPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expoProcess.on("close", (code) => console.log(`[EXPO:${sessionId}] Process closed with code ${code}`));
    await waitForExpoReady(expoProcess);
    const expoUrl = `exp://${getLocalIP()}:8081`;
    await runLogged("adb", ["-s", deviceSerial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", expoUrl], {
      label: `RUN-EXPO:${sessionId}`,
    });
    // ws-scrcpy builds before opening its HTTP/WebSocket server. Don't hand the
    // browser an iframe URL until that server can actually accept connections.
    const streamUrl = createStreamUrl(req, deviceSerial);
    res.status(202).json({ message: "Expo is running on the selected emulator", sessionId, deviceSerial, expoUrl, streamUrl });
  } catch (error) {
    console.error(`[ERROR] Failed to run Expo session ${sessionId}:`, error.message);
    res.status(500).json({ error: error.message, sessionId });
  }
});

app.post("/open-expo", async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: "A valid sessionId is required" });
  }
  if (activeSessionId && activeSessionId !== sessionId) {
    return res.status(409).json({ error: "The active emulator belongs to a different session" });
  }
  try {
    deviceSerial = activeSessionId === sessionId && deviceSerial
      ? deviceSerial
      : await getOnlineEmulatorSerial();
    const expoUrl = `exp://${getLocalIP()}:8081`;
    console.log(`[INFO] Opening Expo at ${expoUrl} on ${deviceSerial}`);
    const { stdout } = await runLogged("adb", ["-s", deviceSerial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", expoUrl], {
      label: "OPEN-EXPO",
    });
    res.json({ message: `Expo app opened at ${expoUrl}`, deviceSerial, output: stdout.trim() });
  } catch (error) {
    console.error("[ERROR] Failed to open Expo:", error.message);
    res.status(500).json({ error: error.message || "Failed to open Expo app" });
  }
});

app.post("/stop", (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: "A valid sessionId is required" });
  }
  if (activeSessionId && activeSessionId !== sessionId) {
    return res.status(409).json({ error: "The active emulator belongs to a different session" });
  }
  for (const process of [expoProcess, scrcpyProcess, emulatorProcess]) {
    if (process && !process.killed) process.kill("SIGTERM");
  }
  expoProcess = scrcpyProcess = emulatorProcess = null;
  deviceSerial = null;
  activeSessionId = null;
  res.json({ message: "Stopped emulator, ws-scrcpy, and Expo app" });
});

app.listen(4000, () => console.log("Backend running on port 4000"));
