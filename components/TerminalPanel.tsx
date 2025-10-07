'use client'

import { useState, useRef, useEffect } from 'react'
import { Terminal, X, Play, Square } from 'lucide-react'
import { fileApi } from '../lib/api'

interface TerminalPanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

interface TerminalOutput {
  id: string;
  command: string;
  output: string;
  error?: string;
  timestamp: Date;
  type: 'command' | 'output' | 'error';
}

export default function TerminalPanel({ isVisible, onToggle }: TerminalPanelProps) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<TerminalOutput[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isVisible])

  useEffect(() => {
    // Scroll to bottom when new output is added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const addToHistory = (entry: Omit<TerminalOutput, 'id' | 'timestamp'>) => {
    setHistory(prev => [...prev, {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date()
    }])
  }

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    setIsExecuting(true)
    addToHistory({
      command: cmd,
      output: '',
      type: 'command'
    })

    // Add to command history
    setCommandHistory(prev => [...prev.filter(c => c !== cmd), cmd])
    setHistoryIndex(-1)

    try {
      const result = await fileApi.executeCommand(cmd, false)
      
      if (result.success) {
        addToHistory({
          command: cmd,
          output: result.stdout || 'Command executed successfully',
          type: 'output'
        })
        
        if (result.stderr) {
          addToHistory({
            command: cmd,
            output: result.stderr,
            type: 'error'
          })
        }
      } else {
        addToHistory({
          command: cmd,
          output: result.error || 'Command failed',
          error: result.stderr,
          type: 'error'
        })
      }
    } catch (error: any) {
      addToHistory({
        command: cmd,
        output: error.message || 'Failed to execute command',
        type: 'error'
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (command.trim() && !isExecuting) {
      executeCommand(command)
      setCommand('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCommand('')
      }
    }
  }

  const clearTerminal = () => {
    setHistory([])
  }

  const quickCommands = [
    'npx expo start',
    'npx expo start --clear',
    'npm install',
    'npm start',
    'ls -la',
    'pwd'
  ]

  if (!isVisible) {
    return (
      <div className="h-8 bg-[#2d2d2d] border-t border-[#333] flex items-center justify-between px-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm"
        >
          <Terminal size={14} />
          Terminal
        </button>
        <div className="text-xs text-gray-500">Click to open terminal</div>
      </div>
    )
  }

  return (
    <div className="h-64 bg-[#1e1e1e] border-t border-[#333] flex flex-col">
      {/* Terminal Header */}
      <div className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center justify-between px-3">
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Terminal size={14} />
          Terminal
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearTerminal}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="h-8 bg-[#252526] border-b border-[#333] flex items-center gap-2 px-3 overflow-x-auto">
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              setCommand(cmd)
              inputRef.current?.focus()
            }}
            className="text-xs px-2 py-1 bg-[#2d2d2d] hover:bg-[#383838] text-gray-300 rounded whitespace-nowrap transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-auto p-3 font-mono text-sm bg-[#1e1e1e]"
      >
        {history.length === 0 && (
          <div className="text-gray-500 text-xs mb-2">
            Welcome to Snack Terminal. Type commands to interact with your project.
          </div>
        )}
        
        {history.map((entry) => (
          <div key={entry.id} className="mb-2">
            {entry.type === 'command' && (
              <div className="text-green-400 flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <span>{entry.command}</span>
              </div>
            )}
            {entry.type === 'output' && (
              <div className="text-gray-300 whitespace-pre-wrap pl-4">
                {entry.output}
              </div>
            )}
            {entry.type === 'error' && (
              <div className="text-red-400 whitespace-pre-wrap pl-4">
                {entry.output}
                {entry.error && <div className="text-red-500">{entry.error}</div>}
              </div>
            )}
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2 text-yellow-400">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-xs">Executing command...</span>
          </div>
        )}
      </div>

      {/* Command Input */}
      <form onSubmit={handleSubmit} className="h-10 bg-[#2d2d2d] border-t border-[#333] flex items-center px-3">
        <span className="text-green-400 mr-2 font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-white font-mono text-sm outline-none placeholder-gray-500"
          disabled={isExecuting}
        />
        <button
          type="submit"
          disabled={!command.trim() || isExecuting}
          className="ml-2 p-1 text-gray-400 hover:text-white disabled:text-gray-600 transition-colors"
        >
          {isExecuting ? <Square size={14} /> : <Play size={14} />}
        </button>
      </form>
    </div>
  )
}