export type BackendFile = { type: 'text' | 'binary' | 'error'; content?: string; extension?: string; size?: number; error?: string };

function baseUrl(port: 3002 | 4000) {
  const configured = port === 3002 ? process.env.NEXT_PUBLIC_FILE_SERVER_URL : process.env.NEXT_PUBLIC_EMULATOR_SERVER_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return `http://${window.location.hostname}:${port}`;
  return `http://localhost:${port}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`Could not reach ${url}. Make sure the matching backend is running and the frontend is opened over HTTP.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details || data.error || `Request failed (${response.status})`);
  return data as T;
}

function json(body: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
  async emulators() {
    const data = await request<{ emulators: string[] }>(`${baseUrl(4000)}/emulators`);
    return data.emulators || [];
  },
  async projects() {
    const data = await request<{ projects: { sessionId: string; projectName: string; updatedAt: string }[] }>(`${baseUrl(4000)}/projects`);
    return data.projects || [];
  },
  async startEmulator(sessionId: string, emulatorName: string) {
    return request(`${baseUrl(4000)}/start`, { method: 'POST', ...json({ sessionId, emulatorName }) });
  },
  async emulatorStream(sessionId: string, emulatorName: string) {
    return request<{ deviceSerial: string; streamUrl: string }>(`${baseUrl(4000)}/stream?sessionId=${encodeURIComponent(sessionId)}&emulatorName=${encodeURIComponent(emulatorName)}`);
  },
  async stopEmulator(sessionId: string) {
    return request(`${baseUrl(4000)}/stop`, { method: 'POST', ...json({ sessionId }) });
  },
  async createProject(sessionId: string, projectName: string) {
    return request<{ sessionId: string; projectName: string; projectPath: string }>(`${baseUrl(4000)}/create-expo`, {
      method: 'POST', ...json({ sessionId, projectName }),
    });
  },
  async runProject(sessionId: string, emulatorName: string) {
    return request<{ message: string; expoUrl: string; streamUrl: string; deviceSerial: string }>(`${baseUrl(4000)}/run-expo`, {
      method: 'POST', ...json({ sessionId, emulatorName }),
    });
  },
  async openExpo(sessionId: string) {
    return request<{ message: string; deviceSerial: string; output: string }>(`${baseUrl(4000)}/open-expo`, {
      method: 'POST', ...json({ sessionId }),
    });
  },
  async files(sessionId: string) {
    const data = await request<{ files: Record<string, BackendFile> }>(`${baseUrl(3002)}/api/get-files?sessionId=${encodeURIComponent(sessionId)}`);
    return data.files || {};
  },
  async saveFile(sessionId: string, filePath: string, content: string) {
    return request(`${baseUrl(3002)}/api/update-file`, { method: 'PUT', ...json({ sessionId, filePath, content }) });
  },
  async addFile(sessionId: string, filePath: string) {
    return request(`${baseUrl(3002)}/api/add-file`, { method: 'POST', ...json({ sessionId, filePath, content: '' }) });
  },
  async command(sessionId: string, command: string, background = false) {
    return request<{ success: boolean; stdout?: string; stderr?: string; error?: string }>(`${baseUrl(3002)}/api/terminal`, {
      method: 'POST', ...json({ sessionId, command, background }),
    });
  },
  async installPackages(sessionId: string) {
    return request<{ success: boolean; stdout?: string; stderr?: string }>(`${baseUrl(3002)}/api/install`, {
      method: 'POST', ...json({ sessionId }),
    });
  },
};
