// API configuration and helper functions
const IP_CONFIG_URL = 'https://raw.githubusercontent.com/anshxs/configs/refs/heads/main/dudusnackip.txt';

// Cache for IP address to avoid fetching on every request
let cachedIP: string | null = null;
let ipFetchPromise: Promise<string> | null = null;

// Function to fetch IP address from GitHub
async function fetchIPAddress(): Promise<string> {
  if (cachedIP) {
    return cachedIP;
  }
  
  if (ipFetchPromise) {
    return ipFetchPromise;
  }
  
  ipFetchPromise = (async () => {
    try {
      const response = await fetch(IP_CONFIG_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch IP: ${response.status}`);
      }
      const ip = (await response.text()).trim();
      cachedIP = ip;
      return ip;
    } catch (error) {
      console.error('Failed to fetch IP address, falling back to localhost:', error);
      cachedIP = 'localhost';
      return 'localhost';
    } finally {
      ipFetchPromise = null;
    }
  })();
  
  return ipFetchPromise;
}

// Dynamic URL builders
async function getFileServerURL(): Promise<string> {
  const ip = await fetchIPAddress();
  return `http://${ip}:3002`;
}

async function getEmulatorServerURL(): Promise<string> {
  const ip = await fetchIPAddress();
  return `http://${ip}:4000`;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface FileContent {
  type: 'text' | 'binary' | 'error';
  content: string;
  extension?: string;
  size?: number;
  error?: string;
}

export interface EmulatorInfo {
  emulators: string[];
}

export interface ProcessInfo {
  pid: string;
  command: string;
}

// File Server API (Port 3002)
export const fileApi = {
  // Get all files from my-app directory
  async getFiles(): Promise<{ [key: string]: FileContent }> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/get-files`);
      const data = await response.json();
      if (data.success) {
        return data.files || {};
      }
      throw new Error(data.error || 'Failed to get files');
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  // Update a file
  async updateFile(filePath: string, content: string): Promise<void> {
    try {
      console.log('API: Updating file:', filePath);
      console.log('API: Content length:', content.length);
      const serverURL = await getFileServerURL();
      console.log('API: Server URL:', `${serverURL}/api/update-file`);
      
      const response = await fetch(`${serverURL}/api/update-file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });
      
      console.log('API: Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API: Response data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update file');
      }
      
      console.log('API: File update successful');
    } catch (error) {
      console.error('API: Error updating file:', filePath, error);
      throw error;
    }
  },

  // Add a new file
  async addFile(filePath: string, content: string = ''): Promise<void> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/add-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add file');
      }
    } catch (error) {
      console.error('Error adding file:', error);
      throw error;
    }
  },

  // Delete a file
  async deleteFile(filePath: string): Promise<void> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/delete-file`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  // Execute terminal command
  async executeCommand(command: string, background: boolean = false): Promise<any> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, background })
      });
      const data = await response.json();
      if (!data.success && response.status !== 500) {
        throw new Error(data.error || 'Command failed');
      }
      return data;
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  },

  // Get running processes
  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/processes`);
      const data = await response.json();
      return data.processes || [];
    } catch (error) {
      console.error('Error getting processes:', error);
      return [];
    }
  },

  // Kill a process
  async killProcess(pid: string): Promise<void> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/kill-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to kill process');
      }
    } catch (error) {
      console.error('Error killing process:', error);
      throw error;
    }
  },

  // Run project with Node 24, npm install, and expo start
  // async runProject(): Promise<{ success: boolean; message: string; url?: string }> {
  //   try {
  //     console.log('Setting up Node 24...');
  //     await this.executeCommand('source $HOME/.nvm/nvm.sh && nvm use 24', false);
      
  //     console.log('Installing dependencies...');
  //     await this.executeCommand('npm install', false);
      
  //     console.log('Starting Expo development server...');
  //     await this.executeCommand('npx expo start --clear', true);
      
  //     // Wait for the server to start
  //     await new Promise(resolve => setTimeout(resolve, 5000));
      
  //     // Return the likely Expo URL
  //     const expoUrl = 'http://localhost:8081';
      
  //     return {
  //       success: true,
  //       message: 'Project started successfully with Node 24',
  //       url: expoUrl
  //     };
  //   } catch (error) {
  //     console.error('Error running project:', error);
  //     return {
  //       success: false,
  //       message: `Error running project: ${error instanceof Error ? error.message : 'Unknown error'}`
  //     };
  //   }
  // },

  // Refresh project from boilerplate
  async refreshProject(): Promise<void> {
    try {
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to refresh project');
      }
    } catch (error) {
      console.error('Error refreshing project:', error);
      throw error;
    }
  },

  // Test backend connectivity
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing backend connection...');
      const serverURL = await getFileServerURL();
      const response = await fetch(`${serverURL}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      console.log('Health check response:', response.status);
      return response.ok;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }
};

// Emulator Server API (Port 4000)
export const emulatorApi = {
  // Get available emulators
  async getEmulators(): Promise<string[]> {
    try {
      const serverURL = await getEmulatorServerURL();
      const response = await fetch(`${serverURL}/emulators`);
      const data: EmulatorInfo = await response.json();
      return data.emulators || [];
    } catch (error) {
      console.error('Error getting emulators:', error);
      return [];
    }
  },

  // Start emulator and scrcpy
  async startEmulator(emulatorName: string): Promise<void> {
    try {
      const serverURL = await getEmulatorServerURL();
      const response = await fetch(`${serverURL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emulatorName })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start emulator');
      }
    } catch (error) {
      console.error('Error starting emulator:', error);
      throw error;
    }
  },

  // Stop emulator and scrcpy
  async stopEmulator(): Promise<void> {
    try {
      const serverURL = await getEmulatorServerURL();
      const response = await fetch(`${serverURL}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to stop emulator');
      }
    } catch (error) {
      console.error('Error stopping emulator:', error);
      throw error;
    }
  },

  // Open URL in emulator
//   async openUrlInEmulator(url: string, udid: string = 'emulator-5554'): Promise<void> {
//     try {
//       const response = await fetch(`${EMULATOR_SERVER_URL}/open-url`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ url, udid })
//       });
//       const data = await response.json();
//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to open URL in emulator');
//       }
//     } catch (error) {
//       console.error('Error opening URL in emulator:', error);
//       throw error;
//     }
//   }
};

// Helper function to convert file structure for frontend
export function convertBackendFilesToFrontend(backendFiles: { [key: string]: FileContent }) {
  const frontendFiles: any[] = [];
  const processedPaths = new Set<string>();

  // Sort paths to ensure parents come before children
  const sortedPaths = Object.keys(backendFiles).sort();

  for (const filePath of sortedPaths) {
    const fileContent = backendFiles[filePath];
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Create directory structure if needed
    let currentPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath += (i > 0 ? '/' : '') + pathParts[i];
      
      if (!processedPaths.has(currentPath)) {
        processedPaths.add(currentPath);
        
        // Find if this directory already exists in our structure
        const existingDir = findFileById(frontendFiles, currentPath);
        if (!existingDir) {
          const dirId = currentPath;
          const parentPath = pathParts.slice(0, i).join('/');
          const parent = parentPath ? findFileById(frontendFiles, parentPath) : null;
          
          const newDir = {
            id: dirId,
            name: pathParts[i],
            type: 'folder' as const,
            children: [],
            parent: parentPath || undefined,
            isOpen: false
          };

          if (parent && parent.type === 'folder') {
            parent.children = parent.children || [];
            parent.children.push(newDir);
          } else if (!parentPath) {
            frontendFiles.push(newDir);
          }
        }
      }
    }

    // Add the file
    if (!processedPaths.has(filePath)) {
      processedPaths.add(filePath);
      
      const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
      const parent = parentPath ? findFileById(frontendFiles, parentPath) : null;
      
      const newFile = {
        id: filePath,
        name: fileName,
        type: 'file' as const,
        content: fileContent.type === 'text' ? fileContent.content : '[Binary file]',
        parent: parentPath || undefined
      };

      if (parent && parent.type === 'folder') {
        parent.children = parent.children || [];
        parent.children.push(newFile);
      } else if (!parentPath) {
        frontendFiles.push(newFile);
      }
    }
  }

  return frontendFiles;
}

// Helper function to find file by ID in nested structure
function findFileById(files: any[], id: string): any {
  for (const file of files) {
    if (file.id === id) {
      return file;
    }
    if (file.children) {
      const found = findFileById(file.children, id);
      if (found) return found;
    }
  }
  return null;
}