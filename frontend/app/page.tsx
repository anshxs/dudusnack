"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api, BackendFile } from "../lib/api";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  ExternalLink,
  Hammer,
  RefreshCw,
  Square,
  ArrowUpRight,
  Braces,
  CircleCheck,
  CircleAlert,
  Circle,
  FolderKanban,
  LoaderCircle,
  Plus,
  Sparkles,
  Play,
} from "lucide-react";

type Project = { sessionId: string; projectName: string };
type FileNode = {
  name: string;
  path: string;
  folder: boolean;
  children: FileNode[];
};

function makeTree(files: Record<string, BackendFile>): FileNode[] {
  const root: FileNode[] = [];
  for (const filePath of Object.keys(files).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  )) {
    const parts = filePath.split("/");
    let current = root;
    let currentPath = "";
    parts.forEach((name, index) => {
      currentPath = currentPath ? `${currentPath}/${name}` : name;
      let node = current.find((item) => item.name === name);
      if (!node) {
        node = {
          name,
          path: currentPath,
          folder: index < parts.length - 1,
          children: [],
        };
        current.push(node);
      }
      current = node.children;
    });
  }
  const sortFoldersFirst = (nodes: FileNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.folder) - Number(a.folder) ||
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
    );
    nodes.forEach((node) => sortFoldersFirst(node.children));
  };
  sortFoldersFirst(root);
  return root;
}

function getFileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const className = `file-kind file-kind-${extension || "default"}`;
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(extension || ""))
    return <FileCode2 size={14} className={className} />;
  if (["json", "jsonc"].includes(extension || ""))
    return <FileJson size={14} className={className} />;
  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(
      extension || "",
    )
  )
    return <FileImage size={14} className={className} />;
  if (["md", "mdx", "txt"].includes(extension || ""))
    return <FileText size={14} className={className} />;
  return <File size={14} className={className} />;
}

function highlightCode(source: string, fileName: string): ReactNode[] {
  const keywords = new Set([
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "interface",
    "let",
    "new",
    "null",
    "of",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "yield",
  ]);
  const tokenPattern =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|===?|!==?|=>|\+\+|--|&&|\|\||[+\-*\/%=<>!&|]+|[{}()[\].,;:?])/g;
  const tokens: ReactNode[] = [];
  let cursor = 0;
  const extension = fileName.split(".").pop()?.toLowerCase();
  for (const match of source.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > cursor) tokens.push(source.slice(cursor, index));
    let kind = "token-name";
    if (/^(\/\/|\/\*|<!--)/.test(token)) kind = "token-comment";
    else if (/^("|'|`)/.test(token)) {
      const rest = source.slice(index + token.length);
      kind =
        (extension === "json" || extension === "jsonc") && /^\s*:/.test(rest)
          ? "token-property"
          : "token-string";
    } else if (/^\d/.test(token)) kind = "token-number";
    else if (keywords.has(token)) kind = "token-keyword";
    else if (/^(===?|!==?|=>|\+\+|--|&&|\|\||[+\-*\/%=<>!&|]+)$/.test(token))
      kind = "token-operator";
    else if (/^[{}()[\].,;:?]$/.test(token)) kind = "token-punctuation";
    else if (/^\s*\(/.test(source.slice(index + token.length)))
      kind = "token-function";
    else if (/^\s*:/.test(source.slice(index + token.length)))
      kind = "token-property";
    else if (
      source[index - 1] === "<" ||
      (source[index - 1] === "/" && source[index - 2] === "<")
    )
      kind = "token-tag";
    tokens.push(
      <span className={kind} key={`${index}-${token}`}>
        {token}
      </span>,
    );
    cursor = index + token.length;
  }
  if (cursor < source.length) tokens.push(source.slice(cursor));
  if (source.endsWith("\n")) tokens.push(" ");
  return tokens;
}

function FileTree({
  nodes,
  active,
  onSelect,
  openFolders,
  onToggle,
  depth = 0,
}: {
  nodes: FileNode[];
  active: string;
  onSelect: (path: string) => void;
  openFolders: Set<string>;
  onToggle: (path: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <button
            className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors hover:bg-zinc-800/70 ${active === node.path ? "bg-[#f40] font-medium text-black" : "text-zinc-400"}`}
            style={{ paddingLeft: 12 + depth * 15 }}
            onClick={() =>
              node.folder ? onToggle(node.path) : onSelect(node.path)
            }
          >
            <span className={`flex w-3 shrink-0 items-center justify-center ${active === node.path ? "text-black/70" : "text-zinc-600"}`}>
              {node.folder ? (
                openFolders.has(node.path) ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )
              ) : null}
            </span>
            <span className={`flex w-4 shrink-0 items-center justify-center ${active === node.path ? "text-black/70" : "text-zinc-500"}`}>
              {node.folder ? (
                openFolders.has(node.path) ? (
                  <FolderOpen size={14} />
                ) : (
                  <Folder size={14} />
                )
              ) : (
                getFileIcon(node.name)
              )}
            </span>
            <span className="truncate">{node.name}</span>
          </button>
          {node.folder && openFolders.has(node.path) && (
            <FileTree
              nodes={node.children}
              active={active}
              onSelect={onSelect}
              openFolders={openFolders}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<
    { sessionId: string; projectName: string; updatedAt: string }[]
  >([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [files, setFiles] = useState<Record<string, BackendFile>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activePath, setActivePath] = useState("");
  const [emulators, setEmulators] = useState<string[]>([]);
  const [selectedEmulator, setSelectedEmulator] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    new Set(["app", "src", "components"]),
  );
  const [busy, setBusy] = useState("");
  const [emulatorRunning, setEmulatorRunning] = useState(false);
  const [runInfo, setRunInfo] = useState<{
    deviceSerial?: string;
    expoUrl?: string;
    streamUrl?: string;
  } | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState("");
  const [showSetup, setShowSetup] = useState(true);
  const [installState, setInstallState] = useState<
    | { sessionId: string; phase: "installing" }
    | { sessionId: string; phase: "failed"; error: string }
    | null
  >(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalBusy, setTerminalBusy] = useState(false);
  const [streamReload, setStreamReload] = useState(0);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);

  const loadEmulators = useCallback(async () => {
    try {
      const result = await api.emulators();
      setEmulators(result);
      setSelectedEmulator((current) =>
        current && result.includes(current) ? current : result[0] || "",
      );
    } catch (error) {
      setStatus(
        `Could not load emulator list: ${error instanceof Error ? error.message : "Connection failed"}`,
      );
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      setProjects(await api.projects());
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load projects",
      );
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadProjectFiles = useCallback(async (sessionId: string) => {
    const result = await api.files(sessionId);
    setFiles(result);
    setDrafts(
      Object.fromEntries(
        Object.entries(result)
          .filter(([, file]) => file.type === "text")
          .map(([filePath, file]) => [filePath, file.content || ""]),
      ),
    );
    setActivePath((current) =>
      current && result[current]?.type === "text"
        ? current
        : Object.keys(result).find((key) => result[key].type === "text") || "",
    );
  }, []);

  useEffect(() => {
    void loadEmulators();
    const stored = localStorage.getItem("dudusnack-project");
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as Project;
      setProject(saved);
      setProjectName(saved.projectName);
      setShowSetup(false);
      loadProjectFiles(saved.sessionId).catch(() => {
        localStorage.removeItem("dudusnack-project");
        setProject(null);
        setShowSetup(true);
      });
    } catch {
      localStorage.removeItem("dudusnack-project");
    }
  }, [loadEmulators, loadProjectFiles]);

  useEffect(() => {
    if (showSetup) void loadProjects();
  }, [showSetup, loadProjects]);

  useEffect(() => {
    if (!streamLoading || !runInfo?.streamUrl) return;
    const timeout = window.setTimeout(() => {
      setStreamLoading(false);
      setStreamFailed(true);
      setStatus("The emulator preview did not respond. Retry the stream.");
    }, 20000);
    return () => window.clearTimeout(timeout);
  }, [streamLoading, runInfo?.streamUrl]);

  const openProject = async (nextProject: Project) => {
    setBusy("open-project");
    setStatus("");
    try {
      await loadProjectFiles(nextProject.sessionId);
      setProject(nextProject);
      setProjectName(nextProject.projectName);
      localStorage.setItem("dudusnack-project", JSON.stringify(nextProject));
      setEmulatorRunning(false);
      setRunInfo(null);
      setShowSetup(false);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not open project",
      );
    } finally {
      setBusy("");
    }
  };

  const installPackages = async (sessionId: string) => {
    setInstallState({ sessionId, phase: "installing" });
    try {
      await api.installPackages(sessionId);
      setInstallState(null);
      setStatus("Project ready. Packages installed.");
    } catch (error) {
      setInstallState({
        sessionId,
        phase: "failed",
        error: error instanceof Error ? error.message : "npm install failed",
      });
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    setBusy("create");
    setStatus("Creating a fresh Expo project…");
    try {
      const sessionId =
        globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
      await api.createProject(sessionId, name);
      const nextProject = { sessionId, projectName: name };
      await loadProjectFiles(sessionId);
      localStorage.setItem("dudusnack-project", JSON.stringify(nextProject));
      setProject(nextProject);
      setShowSetup(false);
      setStatus(`Created ${name}. Installing packages…`);
      await installPackages(sessionId);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not create Expo project",
      );
    } finally {
      setBusy("");
    }
  };

  const startEmulator = async () => {
    if (!project || !selectedEmulator) return;
    setBusy("start");
    setStatus(`Starting ${selectedEmulator}…`);
    try {
      await api.startEmulator(project.sessionId, selectedEmulator);
      setEmulatorRunning(true);
      setStatus(`${selectedEmulator} is starting.`);
      setStreamLoading(true);
      setStreamFailed(false);
      setBusy("");
      // Android boot and stream startup take a little while. Keep checking in
      // the background so the live device appears without launching Expo.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        try {
          const result = await api.emulatorStream(
            project.sessionId,
            selectedEmulator,
          );
          setRunInfo({
            deviceSerial: result.deviceSerial,
            streamUrl: result.streamUrl,
          });
          setStreamLoading(true);
          setStreamFailed(false);
          setStatus(`${selectedEmulator} is connected.`);
          break;
        } catch {
          if (attempt === 39) {
            setStreamLoading(false);
            setStreamFailed(true);
            setStatus(
              `Emulator started, but its screen did not connect. Reload the stream to retry.`,
            );
          }
        }
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not start emulator",
      );
    } finally {
      setBusy("");
    }
  };

  const stopEmulator = async () => {
    if (!project) return;
    setBusy("stop");
    try {
      await api.stopEmulator(project.sessionId);
      setEmulatorRunning(false);
      setRunInfo(null);
      setStreamLoading(false);
      setStreamFailed(false);
      setStatus("Emulator and Expo process stopped.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not stop emulator",
      );
    } finally {
      setBusy("");
    }
  };

  const runProject = async () => {
    if (!project || !selectedEmulator) return;
    setBusy("run");
    setStatus("Building and opening your Expo app…");
    try {
      const result = await api.runProject(project.sessionId, selectedEmulator);
      setRunInfo({
        deviceSerial: result.deviceSerial,
        expoUrl: result.expoUrl,
        streamUrl: result.streamUrl,
      });
      setEmulatorRunning(true);
      setStatus(`Running ${project.projectName} on ${result.deviceSerial}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not run project",
      );
    } finally {
      setBusy("");
    }
  };

  const reloadExpo = async () => {
    if (!project) return;
    setBusy("reload");
    try {
      await api.openExpo(project.sessionId);
      setStatus(
        `Reloaded ${project.projectName} on ${runInfo?.deviceSerial || selectedEmulator}.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not reload Expo app",
      );
    } finally {
      setBusy("");
    }
  };

  const saveFile = useCallback(
    async (filePath: string, content: string) => {
      if (!project || files[filePath]?.type !== "text") return;
      if (content === files[filePath]?.content) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      try {
        await api.saveFile(project.sessionId, filePath, content);
        setFiles((current) => ({
          ...current,
          [filePath]: { ...current[filePath], type: "text", content },
        }));
        setSaveState("saved");
      } catch (error) {
        setSaveState("unsaved");
        setStatus(
          `Could not save ${filePath}: ${error instanceof Error ? error.message : "Save failed"}`,
        );
      }
    },
    [project, files],
  );

  const selectFile = (filePath: string) => {
    if (
      activePath &&
      drafts[activePath] !== undefined &&
      drafts[activePath] !== files[activePath]?.content
    ) {
      void saveFile(activePath, drafts[activePath]);
    }
    setActivePath(filePath);
  };

  const activeContent = drafts[activePath] ?? "";
  useEffect(() => {
    if (
      !project ||
      !activePath ||
      drafts[activePath] === files[activePath]?.content
    )
      return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      void saveFile(activePath, drafts[activePath] ?? "");
    }, 650);
    return () => clearTimeout(timer);
  }, [activePath, drafts, files, project, saveFile]);

  const createFile = async () => {
    if (!project) return;
    const name = window.prompt("File path (for example, components/Card.tsx)");
    if (!name?.trim()) return;
    try {
      await api.addFile(project.sessionId, name.trim());
      const next = await api.files(project.sessionId);
      setFiles(next);
      setDrafts((current) => ({ ...current, [name.trim()]: "" }));
      setActivePath(name.trim());
      const dirs = name
        .trim()
        .split("/")
        .slice(0, -1)
        .map((_, index, parts) => parts.slice(0, index + 1).join("/"));
      setOpenFolders((current) => new Set([...current, ...dirs]));
      setStatus(`Created ${name.trim()}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not create file",
      );
    }
  };

  const executeCommand = async (event: FormEvent) => {
    event.preventDefault();
    const command = terminalCommand.trim();
    if (!project || !command || terminalBusy) return;
    setTerminalBusy(true);
    setTerminalOutput((current) => [...current, `$ ${command}`]);
    setTerminalCommand("");
    try {
      const result = await api.command(project.sessionId, command);
      setTerminalOutput((current) => [
        ...current,
        result.stdout || result.stderr || "Command completed.",
      ]);
    } catch (error) {
      setTerminalOutput((current) => [
        ...current,
        `Error: ${error instanceof Error ? error.message : "Command failed"}`,
      ]);
    } finally {
      setTerminalBusy(false);
    }
  };

  const tree = useMemo(() => makeTree(files), [files]);
  const lineCount = Math.max(1, activeContent.split("\n").length);

  if (showSetup || !project)
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#000000] px-0 py-16 text-white">
        <header className="absolute inset-x-0 top-0 flex h-16 items-center px-6 sm:px-10">
          <span className="ml-2.5 text-sm font-semibold tracking-tight">
            dudu<span className="text-[#f40]"> snack</span>
          </span>
        </header>
        <section className="relative grid w-full max-w-5xl gap-8 rounded-2xl bg-[#f40] p-6 md:grid-cols-[.9fr_1.1fr] sm:p-9">
          <div className="min-w-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px]">
              <Sparkles size={12} /> EXPO WORKSPACE
            </div>
            <h1 className="text-4xl text-black font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl">
              What are we
              <br />
              <span className="text-white">building today?</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white">
              Start with a fresh Expo project. Your files, emulator, and
              development server connect in one workspace.
            </p>
            <form onSubmit={createProject} className="mt-8 space-y-3">
              <label
                htmlFor="project-name"
                className="block text-[10px] font-semibold tracking-[.14em] text-white"
              >
                PROJECT NAME
              </label>
              <input
                id="project-name"
                autoFocus
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="My awesome app"
                maxLength={48}
                className="h-11 w-full rounded-lg px-3.5 text-sm bg-white text-black outline-none transition"
              />
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!projectName.trim() || !!busy}
                type="submit"
              >
                {busy === "create" ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> Creating
                    Expo project…
                  </>
                ) : (
                  <>
                    Create project <ArrowUpRight size={16} />
                  </>
                )}
              </button>
            </form>
            <div className="mt-6 flex items-center gap-2 pt-5 text-xs text-white">
              <Sparkles size={14} className="text-black" />
              Latest Expo boilerplate · Android ready · Autosaved files
            </div>
          </div>
          <div className="flex min-h-72 min-w-0 flex-col pt-6 md:pl-8 md:pt-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-black">
                  Your projects
                </h2>
                <p className="mt-1 text-xs text-white">
                  Continue where you left off.
                </p>
              </div>
              <button
                className="grid size-8 place-items-center rounded-full bg-black disabled:opacity-40"
                onClick={() => void loadProjects()}
                disabled={projectsLoading}
                title="Refresh projects"
                aria-label="Refresh projects"
              >
                <RefreshCw
                  size={14}
                  className={projectsLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {projectsLoading && !projects.length ? (
                <div className="flex items-center gap-2 py-8 text-xs text-zinc-500">
                  <LoaderCircle size={14} className="animate-spin" />
                  Loading projects…
                </div>
              ) : projects.length ? (
                projects.map((item) => (
                  <button
                    key={item.sessionId}
                    className="group flex w-full items-center gap-3 rounded-xl bg-black p-3 text-left transition disabled:opacity-50"
                    onClick={() => void openProject(item)}
                    disabled={!!busy}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg text-black bg-[#fff]">
                      <FolderKanban size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-200">
                        {item.projectName}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-zinc-600">
                        {item.sessionId}
                      </span>
                    </span>
                    {busy === "open-project" ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin text-zinc-500"
                      />
                    ) : (
                      <ArrowUpRight
                        size={15}
                        className="text-zinc-600 transition group-hover:text-orange-500"
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.28] px-5 text-center">
                  <FolderKanban size={22} className="text-white" />
                  <p className="mt-3 text-xs text-white">
                    No saved projects yet
                  </p>
                  <p className="mt-1 text-[10px] text-white">
                    Create your first Expo project to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
          {status && (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-zinc-300 md:col-span-2">
              {status}
            </div>
          )}
        </section>
      </main>
    );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-black text-zinc-100">
      <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-zinc-950 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-950">
            <Braces size={18} />
          </div>
          <span className="shrink-0 text-sm font-semibold tracking-tight">
            dudu<span className="text-[#f40]"> snack</span>
          </span>
          <span className="h-5 border-l border-white/10" />
          <span className="truncate text-sm text-zinc-300">
            {project.projectName}
          </span>
          <span className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-zinc-500 sm:inline">
            EXPO
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
            {saveState === "saved" ? (
              <CircleCheck size={13} className="text-emerald-400" />
            ) : saveState === "saving" ? (
              <LoaderCircle size={13} className="animate-spin text-amber-400" />
            ) : (
              <CircleAlert size={13} className="text-amber-400" />
            )}
            {saveState === "saved"
              ? "All changes saved"
              : saveState === "saving"
                ? "Saving…"
                : "Unsaved changes"}
          </span>
          <button
            className="rounded-md flex items-center gap-2 border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={() => {
              setShowSetup(true);
              setProjectName("");
            }}
          >
            <Plus size={13} />
            New project
          </button>
        </div>
      </header>
      {/* <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-zinc-950/70 px-4 text-[11px] text-zinc-500">
        <span>{project.projectName}</span>
        <ChevronRight size={12} />
        <span className="min-w-0 truncate text-zinc-300">
          {activePath || "Select a file"}
        </span>
        <span className="ml-auto hidden text-zinc-500 sm:block">
          {selectedEmulator
            ? `Android · ${selectedEmulator}`
            : "No emulator selected"}
        </span>
      </div> */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden max-lg:grid-rows-[minmax(0,1fr)_minmax(220px,38%)] lg:grid-cols-[220px_minmax(0,1fr)_minmax(360px,34vw)]">
        <aside className="hidden min-h-0 flex-col border-r border-white/[0.08] bg-zinc-950/70 lg:flex">
          <div className="flex h-11 shrink-0 items-center justify-between px-4 text-[10px] font-semibold tracking-[.14em] text-zinc-500">
            <span>PROJECT FILES</span>
            <button
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              title="Create file"
              onClick={createFile}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex h-9 shrink-0 items-center gap-2 border-y border-white/[0.05] px-3 text-xs text-zinc-400">
            <ChevronDown size={13} className="text-zinc-600" />
            <FolderOpen size={14} className="text-zinc-500" />
            <b>{project.projectName}</b>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {tree.length ? (
              <FileTree
                nodes={tree}
                active={activePath}
                onSelect={selectFile}
                openFolders={openFolders}
                onToggle={(folder) =>
                  setOpenFolders((current) => {
                    const next = new Set(current);
                    next.has(folder) ? next.delete(folder) : next.add(folder);
                    return next;
                  })
                }
              />
            ) : (
              <div className="p-3 text-xs text-zinc-500">
                Loading project files…
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.07] px-4 py-3 text-[9px] font-medium tracking-wide text-zinc-500">
            <CircleCheck
              size={12}
              className="mr-1.5 inline-block text-emerald-400"
            />{" "}
            FILE SERVER CONNECTED
            <div className="mt-1.5 pl-3.5 text-zinc-600">
              Session {project.sessionId.slice(0, 8)}
            </div>
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#080808]">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.07] bg-zinc-950/50 px-4">
            {activePath ? (
              <div className="flex h-full items-center gap-2 border-b border-[#f40] text-xs text-zinc-300">
                <Braces size={13} className="text-[#f40]" />
                {activePath}
                <span className="tab-state">
                  {saveState === "saved" ? null : (
                    <Circle
                      size={7}
                      className="fill-amber-400 text-amber-400"
                    />
                  )}
                </span>
              </div>
            ) : (
              <span className="text-xs text-zinc-600">No file open</span>
            )}
            <span className="text-[10px] tracking-wider text-zinc-600">
              {activePath.split(".").pop()?.toUpperCase() || "CODE"}
            </span>
          </div>
          {activePath ? (
            <div className="flex min-h-0 flex-1 overflow-hidden py-3">
              <div
                className="flex w-12 shrink-0 flex-col items-end overflow-hidden pr-3 font-mono text-[11px] leading-5 text-zinc-700"
                ref={lineNumbersRef}
              >
                {Array.from({ length: lineCount }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                <pre
                  className="pointer-events-none absolute inset-0 overflow-hidden p-0 font-mono text-[11px] leading-5 text-zinc-300"
                  ref={highlightRef}
                  aria-hidden="true"
                >
                  <code>{highlightCode(activeContent, activePath)}</code>
                </pre>
                <textarea
                  className="absolute inset-0 z-10 block size-full resize-none overflow-auto bg-transparent p-0 font-mono text-[11px] leading-5 text-transparent caret-[#f40] outline-none selection:bg-orange-500/30"
                  spellCheck={false}
                  aria-label={`Edit ${activePath}`}
                  value={activeContent}
                  onScroll={(event) => {
                    const { scrollTop, scrollLeft } = event.currentTarget;
                    if (highlightRef.current) {
                      highlightRef.current.scrollTop = scrollTop;
                      highlightRef.current.scrollLeft = scrollLeft;
                    }
                    if (lineNumbersRef.current)
                      lineNumbersRef.current.scrollTop = scrollTop;
                  }}
                  onChange={(event) => {
                    setDrafts((current) => ({
                      ...current,
                      [activePath]: event.target.value,
                    }));
                    setSaveState("saving");
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
              <div className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500">
                <Braces size={20} />
              </div>
              <h2 className="mt-4 text-sm font-medium text-zinc-300">
                Your canvas is ready
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                Choose a file from the project tree to start editing.
              </p>
            </div>
          )}
          <section
            className={`shrink-0 border-t border-white/[0.08] bg-zinc-950/70 ${terminalOpen ? "h-52" : "h-9"}`}
          >
            <div className="flex h-9 items-center justify-between px-3">
              <button
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
                onClick={() => setTerminalOpen((value) => !value)}
              >
                {terminalOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}{" "}
                <span>Terminal</span>
              </button>
              <button
                className="text-[10px] text-zinc-600 hover:text-zinc-300"
                onClick={() => setTerminalOutput([])}
              >
                Clear
              </button>
            </div>
            {terminalOpen && (
              <>
                <div className="h-[calc(100%-5rem)] overflow-auto px-4 font-mono text-xs text-zinc-400">
                  {terminalOutput.length ? (
                    terminalOutput.map((line, index) => (
                      <pre key={index}>{line}</pre>
                    ))
                  ) : (
                    <span className="text-zinc-600">
                      Run a development command in this session&apos;s project
                      folder.
                    </span>
                  )}
                </div>
                <form
                  className="flex h-10 items-center gap-2 border-t border-white/[0.07] px-4 font-mono text-xs"
                  onSubmit={executeCommand}
                >
                  <span className="text-[#f40]">$</span>
                  <input
                    value={terminalCommand}
                    onChange={(event) => setTerminalCommand(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-700"
                    placeholder="npm install · npx expo doctor · ls"
                  />
                  <button
                    className="rounded bg-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/15 disabled:opacity-40"
                    disabled={terminalBusy || !terminalCommand.trim()}
                  >
                    {terminalBusy ? "Running…" : "Run"}
                  </button>
                </form>
              </>
            )}
          </section>
          <div className="flex h-7 shrink-0 items-center justify-end gap-4 border-t border-white/[0.06] px-3 text-[9px] text-zinc-600">
            <span>{activePath || project.projectName}</span>
            <span>UTF-8</span>
            <span>Spaces: 2</span>
            <span>Expo · React Native</span>
          </div>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-l border-white/[0.08] bg-zinc-950/70 p-2 sm:p-3 max-lg:border-l-0 max-lg:border-t">
          <div className="flex h-9 shrink-0 items-center gap-1.5">
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-white/10 bg-white/[0.03] px-2">
              <select
                className="h-full min-w-0 flex-1 appearance-none bg-transparent text-[11px] text-zinc-200 outline-none"
                id="emulator"
                aria-label="Select Android emulator"
                value={selectedEmulator}
                onChange={(event) => setSelectedEmulator(event.target.value)}
              >
                <option value="">Select emulator</option>
                {emulators.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="shrink-0 text-zinc-500" />
            </div>
            <button
              className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              title="Refresh emulator list"
              aria-label="Refresh emulator list"
              onClick={() => void loadEmulators()}
            >
              <RefreshCw size={13} />
            </button>
            {runInfo?.streamUrl ? (
              <a
                className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                title="Open emulator in new tab"
                aria-label="Open emulator in new tab"
                href={runInfo.streamUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
              </a>
            ) : (
              <span
                className="grid size-8 shrink-0 place-items-center rounded-md border border-white/[0.05] text-zinc-700"
                title="Emulator stream not connected"
              >
                <ExternalLink size={14} />
              </span>
            )}
            <button
              className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-zinc-400 transition hover:bg-white/[0.06] hover:text-red-300 disabled:opacity-30"
              title="Stop emulator"
              aria-label="Stop emulator"
              disabled={!emulatorRunning || !!busy}
              onClick={stopEmulator}
            >
              <Square size={13} />
            </button>
            <button
              className="flex h-8 min-w-[82px] shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#f40] px-3 text-[11px] font-semibold text-black transition hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                !!busy ||
                (!emulatorRunning && !selectedEmulator) ||
                (emulatorRunning && !runInfo?.deviceSerial)
              }
              onClick={() => {
                if (!emulatorRunning) void startEmulator();
                else if (!runInfo?.expoUrl) void runProject();
                else void reloadExpo();
              }}
            >
              {busy === "start" ? (
                "Starting…"
              ) : busy === "run" ? (
                "Building…"
              ) : busy === "reload" ? (
                "Reloading…"
              ) : !emulatorRunning ? (
                <>
                  <Play size={12} fill="currentColor" /> Start
                </>
              ) : !runInfo?.expoUrl ? (
                <>
                  <Hammer size={12} /> Build
                </>
              ) : (
                <>
                  <RefreshCw size={12} /> Reload
                </>
              )}
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden rounded-lg border border-white/10 bg-[#050506]">
            {runInfo?.streamUrl ? (
              <>
                <iframe
                  className="block h-full w-full min-w-0 flex-1 border-0 bg-black"
                  key={`${runInfo.deviceSerial}-${streamReload}`}
                  src={runInfo.streamUrl}
                  title="Android emulator screen and controls"
                  allow="clipboard-read; clipboard-write"
                  onLoad={() => {
                    setStreamLoading(false);
                    setStreamFailed(false);
                  }}
                  onError={() => {
                    setStreamLoading(false);
                    setStreamFailed(true);
                  }}
                />
                {(streamLoading || streamFailed) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 text-xs text-zinc-300">
                    {streamFailed ? (
                      <>
                        <b className="font-medium text-white">
                          Stream unavailable
                        </b>
                        <button
                          className="mt-1 grid size-8 place-items-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/10"
                          title="Retry emulator stream"
                          aria-label="Retry emulator stream"
                          onClick={() => {
                            setStreamFailed(false);
                            setStreamLoading(true);
                            setStreamReload((value) => value + 1);
                          }}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <LoaderCircle
                          size={16}
                          className="animate-spin text-[#f40]"
                        />
                        <span>Connecting to emulator…</span>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="grid size-10 place-items-center self-center rounded-xl border border-white/[0.06] text-zinc-800">
                <Play size={16} />
              </div>
            )}
          </div>
        </aside>
      </div>
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-white/[0.07] bg-zinc-950 px-4 text-[9px] text-zinc-500">
        <span>
          <CircleCheck
            size={12}
            className="mr-1.5 inline-block text-emerald-400"
          />{" "}
          READY
        </span>
        <span>
          {status || "Edits save automatically to your session project."}
        </span>
        <span>ANDROID ONLY</span>
      </footer>
      {installState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <div className="mb-4 grid size-11 place-items-center rounded-xl border border-[#f40]/30 bg-[#f40]/10 text-[#f40]">
              {installState.phase === "installing" ? (
                <LoaderCircle size={21} className="animate-spin" />
              ) : (
                <CircleAlert size={21} className="text-red-400" />
              )}
            </div>
            <h2 id="install-title" className="text-base font-semibold text-white">
              {installState.phase === "installing" ? "Installing packages" : "Package installation failed"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {installState.phase === "installing"
                ? "Running npm install for your new Expo project. This can take a few minutes."
                : "npm install did not complete. Retry the installation to finish setting up this project."}
            </p>
            {installState.phase === "failed" && (
              <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/[0.07] bg-black/40 p-3 font-mono text-[11px] leading-5 text-red-200/80">
                {installState.error}
              </pre>
            )}
            {installState.phase === "installing" ? (
              <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[#f40]" />
              </div>
            ) : (
              <button
                className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#f40] text-sm font-semibold text-black transition hover:bg-[#ff5a1f]"
                onClick={() => void installPackages(installState.sessionId)}
              >
                <RefreshCw size={14} /> Retry npm install
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
