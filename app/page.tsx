"use client";

import { useState, useCallback, useEffect } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Header from "../components/Header";
import FileExplorer from "../components/FileExplorer";
import CodeEditor from "../components/CodeEditor";
import PreviewPanel from "../components/PreviewPanel";
import { fileApi, convertBackendFilesToFrontend } from "../lib/api";
import TerminalPanel from "@/components/TerminalPanel";
import StatusBar from "@/components/StatusBar";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  parent?: string;
  isOpen?: boolean;
}

interface EditorTab {
  id: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

type PreviewMode = "android" | "web";

export default function Home() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("android");
  const [projectUrl, setProjectUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Load files from backend on component mount
  useEffect(() => {
    loadFilesFromBackend();
  }, []);

  const loadFilesFromBackend = async () => {
    setIsLoading(true);
    try {
      // First test backend connection
      const isConnected = await fileApi.testConnection();
      if (!isConnected) {
        throw new Error('Backend server is not responding');
      }
      
      console.log('Backend connection successful, loading files...');
      const backendFiles = await fileApi.getFiles();
      console.log('Files loaded from backend:', Object.keys(backendFiles));
      
      const frontendFiles = convertBackendFilesToFrontend(backendFiles);
      setFiles(frontendFiles);
    } catch (error) {
      console.error("Failed to load files:", error);
      
      // Show user-friendly error message
      alert(`Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback files.`);
      // Fallback to default files if backend is not available
      setFiles([
        {
          id: "App.js",
          name: "App.js",
          type: "file",
          content: `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello, Snack!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      if (file.type === "file") {
        // Check if tab already exists
        const existingTab = openTabs.find((tab) => tab.id === file.id);
        if (existingTab) {
          setActiveTabId(file.id);
        } else {
          // Create new tab
          const newTab: EditorTab = {
            id: file.id,
            name: file.name,
            content: file.content || "",
            language: getLanguageFromFileName(file.name),
            isDirty: false,
          };
          setOpenTabs((prev) => [...prev, newTab]);
          setActiveTabId(file.id);
        }
      }
    },
    [openTabs]
  );

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId: string) => {
    setOpenTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) {
      const remainingTabs = openTabs.filter((tab) => tab.id !== tabId);
      setActiveTabId(
        remainingTabs.length > 0
          ? remainingTabs[remainingTabs.length - 1].id
          : null
      );
    }
  };

  const handleContentChange = async (tabId: string, content: string) => {
    console.log('Content change for file:', tabId);
    console.log('Content length:', content.length);
    
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, content, isDirty: true } : tab
      )
    );

    // Update file content locally
    setFiles((prev) => updateFileContent(prev, tabId, content));

    // Save to backend with better error handling
    try {
      console.log('Attempting to save file to backend:', tabId);
      await fileApi.updateFile(tabId, content);
      console.log('File saved successfully:', tabId);
      
      // Mark tab as clean after successful save
      setOpenTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, isDirty: false } : tab))
      );
    } catch (error) {
      console.error("Failed to save file:", tabId, error);
      
      // Keep tab as dirty if save failed
      setOpenTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, isDirty: true } : tab))
      );
      
      // Show user-friendly error
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateFileContent = (
    files: FileNode[],
    fileId: string,
    content: string
  ): FileNode[] => {
    return files.map((file) => {
      if (file.id === fileId) {
        return { ...file, content };
      }
      if (file.children) {
        return {
          ...file,
          children: updateFileContent(file.children, fileId, content),
        };
      }
      return file;
    });
  };

  const handleCreateFile = async (parentId: string | null, name: string) => {
    const filePath = parentId ? `${parentId}/${name}` : name;

    try {
      await fileApi.addFile(filePath, "");
      // Reload files from backend to get updated structure
      await loadFilesFromBackend();
    } catch (error) {
      console.error("Failed to create file:", error);
      // Fallback to local creation
      const newFile: FileNode = {
        id: filePath,
        name,
        type: "file",
        content: "",
        parent: parentId || undefined,
      };

      setFiles((prev) => {
        if (!parentId) {
          return [...prev, newFile];
        }
        return addFileToParent(prev, parentId, newFile);
      });
    }
  };

  const handleCreateFolder = async (parentId: string | null, name: string) => {
    // For folders, we'll just create them locally since the backend
    // will create them automatically when files are added
    const folderPath = parentId ? `${parentId}/${name}` : name;

    const newFolder: FileNode = {
      id: folderPath,
      name,
      type: "folder",
      children: [],
      parent: parentId || undefined,
      isOpen: false,
    };

    setFiles((prev) => {
      if (!parentId) {
        return [...prev, newFolder];
      }
      return addFileToParent(prev, parentId, newFolder);
    });
  };

  const addFileToParent = (
    files: FileNode[],
    parentId: string,
    newItem: FileNode
  ): FileNode[] => {
    return files.map((file) => {
      if (file.id === parentId && file.type === "folder") {
        return {
          ...file,
          children: [...(file.children || []), newItem],
        };
      }
      if (file.children) {
        return {
          ...file,
          children: addFileToParent(file.children, parentId, newItem),
        };
      }
      return file;
    });
  };

  const handleToggleFolder = (folderId: string) => {
    setFiles((prev) => toggleFolder(prev, folderId));
  };

  const toggleFolder = (files: FileNode[], folderId: string): FileNode[] => {
    return files.map((file) => {
      if (file.id === folderId && file.type === "folder") {
        return { ...file, isOpen: !file.isOpen };
      }
      if (file.children) {
        return { ...file, children: toggleFolder(file.children, folderId) };
      }
      return file;
    });
  };

  const getLanguageFromFileName = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "js":
      case "jsx":
        return "javascript";
      case "ts":
      case "tsx":
        return "typescript";
      case "json":
        return "json";
      case "css":
        return "css";
      case "html":
        return "html";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  };

  const handleGithubImport = () => {
    // TODO: Implement GitHub import
    console.log("GitHub import requested");
  };

  // const handleRunProject = async () => {
  //   try {
  //     console.log("Starting project with Node 24, npm install, and expo start...");
  //     const result = await fileApi.runProject();

  //     if (result.success && result.url) {
  //       setProjectUrl(result.url);
  //       console.log(`Project started successfully. URL: ${result.url}`);
  //     } else {
  //       console.error("Failed to start project:", result.message);
  //     }
  //   } catch (error) {
  //     console.error("Failed to run project:", error);
  //   }
  // };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-[#1e1e1e] items-center justify-center">
        <div className="text-white text-lg">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <Header
        onGithubImport={handleGithubImport}
        onRunProject={function (): void {
          throw new Error("Function not implemented.");
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <PanelGroup direction="horizontal">
            {/* File Explorer */}
            <Panel defaultSize={18} minSize={15} maxSize={30}>
              <FileExplorer
                files={files}
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onToggleFolder={handleToggleFolder}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-[#333] hover:bg-[#444] transition-colors" />

            {/* Editor */}
            <Panel defaultSize={55} minSize={35}>
              <CodeEditor
                tabs={openTabs}
                activeTabId={activeTabId}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
                onContentChange={handleContentChange}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-[#333] hover:bg-[#444] transition-colors" />

            {/* Preview */}
            <Panel defaultSize={27} minSize={27} maxSize={27}>
              <PreviewPanel
                previewMode={previewMode}
                onPreviewModeChange={setPreviewMode}
                projectUrl={projectUrl}
              />
            </Panel>
          </PanelGroup>
        </div>

        {/* Terminal */}
        <TerminalPanel
          isVisible={terminalVisible}
          onToggle={() => setTerminalVisible(!terminalVisible)}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        onTerminalToggle={() => setTerminalVisible(!terminalVisible)}
      />
    </div>
  );
}
