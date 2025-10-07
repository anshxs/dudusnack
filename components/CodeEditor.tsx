'use client'

import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { X, Circle } from 'lucide-react'
import { AnimatedGradientText } from './ui/animated-gradient-text';

interface EditorTab {
  id: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface CodeEditorProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
}

const getLanguageFromFileName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'js':
      return 'javascript'
    case 'jsx':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'tsx':
      return 'typescript'
    case 'css':
      return 'css'
    case 'scss':
    case 'sass':
      return 'scss'
    case 'less':
      return 'less'
    case 'html':
      return 'html'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'py':
      return 'python'
    case 'java':
      return 'java'
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp'
    case 'c':
      return 'c'
    case 'php':
      return 'php'
    case 'rb':
      return 'ruby'
    case 'go':
      return 'go'
    case 'rs':
      return 'rust'
    case 'swift':
      return 'swift'
    case 'kt':
      return 'kotlin'
    case 'dart':
      return 'dart'
    case 'xml':
      return 'xml'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'sql':
      return 'sql'
    case 'sh':
    case 'bash':
      return 'shell'
    case 'dockerfile':
      return 'dockerfile'
    default:
      return 'plaintext'
  }
}

export default function CodeEditor({ tabs, activeTabId, onTabChange, onTabClose, onContentChange }: CodeEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  const handleEditorChange = (value: string | undefined) => {
    if (activeTabId && value !== undefined) {
      onContentChange(activeTabId, value)
    }
  }

  // if (!mounted) {
  //   return (
  //     <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
  //       <div className="text-gray-400">Loading editor...</div>
  //     </div>
  //   )
  // }

  return (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col">
      {/* Tab Bar */}
      <div className="flex bg-[#2d2d2d] border-b border-[#333] overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-2 border-r border-[#333] cursor-pointer group min-w-0 max-w-48 ${
              tab.id === activeTabId 
                ? 'bg-[#1e1e1e] text-white' 
                : 'bg-[#2d2d2d] text-gray-300 hover:bg-[#3d3d3d]'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {tab.isDirty && <Circle size={6} className="text-white fill-current" />}
              <span className="truncate text-sm">{tab.name}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              className="p-1 hover:bg-[#444] rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Content */}
      <div className="flex-1 min-h-0 monaco-editor-container">
        {activeTab ? (
          <Editor
            height="100%"
            language={getLanguageFromFileName(activeTab.name)}
            value={activeTab.content}
            onChange={handleEditorChange}
            theme="vs-dark"
            loading={<div className="flex items-center justify-center h-full text-gray-400">Loading...</div>}
            beforeMount={(monaco) => {
              // Disable diagnostics for TypeScript/JavaScript
              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: true,
                noSuggestionDiagnostics: true
              });
              
              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: true,
                noSuggestionDiagnostics: true
              });

              // Disable JSON diagnostics
              monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: false,
                allowComments: true,
                schemas: [],
                enableSchemaRequest: false
              });
            }}
            options={{
              automaticLayout: true,
              fontSize: 14,
              fontFamily: 'Monaco, "Cascadia Code", Consolas, "Courier New", monospace',
              fontWeight: '400',
              lineHeight: 1.4,
              
              // Minimap and scrolling
              minimap: { 
                enabled: true,
                side: 'right',
                scale: 1,
                showSlider: 'mouseover'
              },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              
              // Word wrap and text handling
              wordWrap: 'on',
              wordWrapColumn: 120,
              wrappingIndent: 'indent',
              
              // Editor behavior
              tabSize: 2,
              insertSpaces: true,
              detectIndentation: true,
              trimAutoWhitespace: true,
              
              // Visual elements
              renderWhitespace: 'selection',
              renderControlCharacters: false,
              renderLineHighlight: 'line',
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'mouseover',
              
              // Line numbers and gutter
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              lineDecorationsWidth: 10,
              glyphMargin: true,
              
              // Code formatting
              formatOnPaste: true,
              formatOnType: true,
              autoIndent: 'full',
              
              // IntelliSense and suggestions
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true
              },
              quickSuggestionsDelay: 100,
              parameterHints: {
                enabled: true,
                cycle: true
              },
              hover: {
                enabled: true,
                delay: 300
              },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              
              // Cursor and selection
              cursorBlinking: 'blink',
              cursorSmoothCaretAnimation: 'on',
              cursorStyle: 'line',
              cursorWidth: 2,
              
              // Scrolling and zoom
              mouseWheelZoom: true,
              mouseWheelScrollSensitivity: 1,
              fastScrollSensitivity: 5,
              
              // Performance
              readOnly: false,
              contextmenu: true,
              
              // Ensure editor starts at top
              revealHorizontalRightPadding: 30,
              scrollbar: {
                verticalScrollbarSize: 14,
                horizontalScrollbarSize: 14,
                arrowSize: 11,
                useShadows: true,
                verticalHasArrows: false,
                horizontalHasArrows: false
              }
            }}
            onMount={(editor) => {
              // Ensure editor scrolls to top when file opens
              editor.setPosition({ lineNumber: 1, column: 1 });
              editor.revealLine(1);
              editor.focus();
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-lg font-semibold my-12 mb-2">Welcome to Snack</div>
              <div className="text-sm">Open a file from the file explorer to start editing</div>
              <div className="text-sm text-white mt-2"><AnimatedGradientText>Copyright © 2025 Team Dudu</AnimatedGradientText></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}