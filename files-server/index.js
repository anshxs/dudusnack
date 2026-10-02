const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { spawn, exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3002;
const sessionsPath = path.join(__dirname, 'sessions');
const boilerplatePath = path.join(__dirname, '..', 'boilerplate');
const sessionProcesses = new Map();

app.use(express.json({ limit: '25mb' }));
app.use(cors());

function getSessionId(req) {
  const id = req.body?.sessionId || req.query.sessionId;
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

function requireSession(req, res) {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    res.status(400).json({ error: 'A valid sessionId is required (letters, numbers, _ and - only)' });
    return null;
  }
  return sessionId;
}

function appPathFor(sessionId) {
  return path.join(sessionsPath, sessionId, 'app');
}

function safeFilePath(root, filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || path.isAbsolute(filePath)) {
    throw new Error('A relative filePath is required');
  }
  const fullPath = path.resolve(root, filePath);
  if (!fullPath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error('filePath must stay inside the session app folder');
  }
  return fullPath;
}

async function copyDirectory(source, destination) {
  await fs.cp(source, destination, { recursive: true, filter: (sourcePath) => !sourcePath.split(path.sep).includes('node_modules') });
}

async function getAllFiles(directory, basePath = directory) {
  const files = {};
  const ignored = new Set(['node_modules', '.expo', '.git', 'ios', 'android', 'dist', 'web-build', '.DS_Store']);
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(basePath, fullPath);
    if (entry.isDirectory()) {
      Object.assign(files, await getAllFiles(fullPath, basePath));
      continue;
    }
    const content = await fs.readFile(fullPath);
    if (content.includes(0)) {
      files[relativePath] = { type: 'binary', extension: path.extname(entry.name), content: content.toString('base64'), size: content.length };
    } else {
      files[relativePath] = { type: 'text', content: content.toString('utf8') };
    }
  }
  return files;
}

async function writeFiles(root, files, replace = false) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Files object is required');
  if (replace) await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  const results = [];
  for (const [filePath, value] of Object.entries(files)) {
    try {
      const destination = safeFilePath(root, filePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      if (value && typeof value === 'object' && value.type === 'binary') {
        await fs.writeFile(destination, Buffer.from(value.content || '', 'base64'));
      } else if (value && typeof value === 'object' && value.type === 'text') {
        await fs.writeFile(destination, value.content ?? '', 'utf8');
      } else if (value && typeof value === 'object' && value.type === 'error') {
        results.push({ filePath, status: 'skipped', reason: value.error });
        continue;
      } else if (typeof value === 'string' && value !== '[Binary file or unreadable]') {
        await fs.writeFile(destination, value, 'utf8');
      } else {
        results.push({ filePath, status: 'skipped', reason: 'unsupported content' });
        continue;
      }
      results.push({ filePath, status: 'success' });
    } catch (error) {
      results.push({ filePath, status: 'error', error: error.message });
    }
  }
  return results;
}

function runCommand(command, options, callback) {
  exec(command, { maxBuffer: 1024 * 1024, ...options }, callback);
}

// Update an existing file.
app.put('/api/update-file', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const { filePath, content } = req.body;
  if (content === undefined) return res.status(400).json({ error: 'filePath and content are required' });
  try {
    const destination = safeFilePath(appPathFor(sessionId), filePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, 'utf8');
    res.json({ success: true, message: `File ${filePath} updated`, sessionId, filePath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a file, failing if it already exists.
app.post('/api/add-file', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const { filePath, content = '' } = req.body;
  try {
    const destination = safeFilePath(appPathFor(sessionId), filePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, { encoding: 'utf8', flag: 'wx' });
    res.json({ success: true, message: `File ${filePath} created`, sessionId, filePath });
  } catch (error) {
    res.status(error.code === 'EEXIST' ? 400 : 400).json({ error: error.code === 'EEXIST' ? `File ${filePath} already exists` : error.message });
  }
});

// Delete a file.
app.delete('/api/delete-file', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  try {
    const destination = safeFilePath(appPathFor(sessionId), req.body.filePath);
    await fs.unlink(destination);
    res.json({ success: true, message: `File ${req.body.filePath} deleted`, sessionId });
  } catch (error) {
    res.status(error.code === 'ENOENT' ? 404 : 400).json({ error: error.message });
  }
});

// Reset this session's app from the shared boilerplate folder.
app.post('/api/refresh', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  try {
    await fs.access(boilerplatePath);
    const destination = appPathFor(sessionId);
    await fs.rm(destination, { recursive: true, force: true });
    await copyDirectory(boilerplatePath, destination);
    res.json({ success: true, message: 'Session app refreshed from boilerplate', sessionId });
  } catch (error) {
    res.status(500).json({ error: `Refresh failed: ${error.message}`, sessionId });
  }
});

// Apply a frontend files map to this session.
app.post('/api/already-exists', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  try {
    const root = appPathFor(sessionId);
    try { await fs.access(root); }
    catch {
      await fs.access(boilerplatePath);
      await copyDirectory(boilerplatePath, root);
    }
    const results = await writeFiles(root, req.body.files);
    res.json({ success: true, message: 'Session files updated', sessionId, results, totalProcessed: Object.keys(req.body.files || {}).length });
  } catch (error) {
    res.status(400).json({ error: error.message, sessionId });
  }
});

// Read this session's project files.
app.get('/api/get-files', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  try {
    const files = await getAllFiles(appPathFor(sessionId));
    res.json({ success: true, sessionId, files, totalFiles: Object.keys(files).length });
  } catch (error) {
    res.status(error.code === 'ENOENT' ? 404 : 500).json({ error: error.code === 'ENOENT' ? 'Session app not found' : error.message, sessionId });
  }
});

// Replace this session's project files with a files map.
app.post('/api/replace-files', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  try {
    const results = await writeFiles(appPathFor(sessionId), req.body.files, true);
    res.json({ success: true, message: 'Session files replaced', sessionId, results });
  } catch (error) {
    res.status(400).json({ error: error.message, sessionId });
  }
});

// Run an allowed development command inside the session app folder.
app.post('/api/terminal', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const { command, background = false } = req.body;
  const allowed = /^(npm (start|run start|install|i)|npx expo (start( --(clear|tunnel|localhost|lan))?|install|doctor|prebuild|run:(ios|android))|yarn (start|install|add|remove)|expo (start( --(clear|tunnel|localhost|lan))?|install|doctor|prebuild|run:(ios|android))|ls|pwd|whoami|node --version|npm --version|nvm use 24)( .*)?$/.test(command || '');
  if (!allowed || /[;&|`$<>\n]/.test(command)) return res.status(403).json({ error: 'Command is not allowed' });
  const cwd = appPathFor(sessionId);
  try { await fs.access(cwd); }
  catch { return res.status(404).json({ error: 'Session app not found. Create or refresh it first.', sessionId }); }

  if (background) {
    const child = spawn('bash', ['-lc', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const processes = sessionProcesses.get(sessionId) || new Map();
    processes.set(String(child.pid), child);
    sessionProcesses.set(sessionId, processes);
    child.on('close', () => processes.delete(String(child.pid)));
    res.json({ success: true, message: `Background command started: ${command}`, sessionId, pid: child.pid, type: 'background', command });
    return;
  }

  runCommand(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
    if (error) return res.status(500).json({ error: `Command failed: ${error.message}`, sessionId, stderr, exitCode: error.code });
    res.json({ success: true, sessionId, command, stdout, stderr, type: 'sync' });
  });
});

app.post('/api/install', async (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const cwd = appPathFor(sessionId);
  try {
    await fs.access(path.join(cwd, 'package.json'));
  } catch {
    return res.status(404).json({ error: 'Project package.json not found', sessionId });
  }

  runCommand('npm install', { cwd, timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'Package installation failed',
        details: error.killed
          ? 'npm install timed out after 10 minutes'
          : (stderr || stdout || error.message).slice(-12000),
        sessionId,
        stdout: stdout?.slice(-12000),
        stderr: stderr?.slice(-12000),
        exitCode: error.code,
      });
    }
    res.json({ success: true, sessionId, stdout, stderr });
  });
});

// List background commands owned by this session.
app.get('/api/processes', (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const processes = [...(sessionProcesses.get(sessionId) || new Map())]
    .map(([pid, child]) => ({ pid, command: child.spawnargs.join(' ') }));
  res.json({ success: true, sessionId, processes });
});

// Stop only a process started by this session.
app.post('/api/kill-process', (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  const pid = String(req.body.pid || '');
  const processes = sessionProcesses.get(sessionId);
  const child = processes?.get(pid);
  if (!child) return res.status(404).json({ error: 'Process not found in this session', sessionId });
  child.kill('SIGTERM');
  processes.delete(pid);
  res.json({ success: true, message: `Process ${pid} stopped`, sessionId });
});

app.get('/api/health', (req, res) => {
  const sessionId = requireSession(req, res);
  if (!sessionId) return;
  res.json({ success: true, message: 'Files server is running', sessionId, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Files server running on http://localhost:${PORT}`);
  console.log('All /api routes require sessionId in JSON body or query string.');
});

module.exports = app;
