'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Server, Smartphone, AlertCircle } from 'lucide-react'

interface StatusBarProps {
  onTerminalToggle: () => void;
}

export default function StatusBar({ onTerminalToggle }: StatusBarProps) {
  const [fileServerStatus, setFileServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [emulatorServerStatus, setEmulatorServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [projectRunning, setProjectRunning] = useState(false)

  useEffect(() => {
    checkServerStatus()
    const interval = setInterval(checkServerStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkServerStatus = async () => {
    // Check file server (port 3002)
    try {
      const response = await fetch('http://localhost:3002/api/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      setFileServerStatus(response.ok ? 'connected' : 'disconnected')
    } catch (error) {
      setFileServerStatus('disconnected')
    }

    // Check emulator server (port 4000)
    try {
      const response = await fetch('http://localhost:4000/emulators', {
        method: 'GET', 
        signal: AbortSignal.timeout(5000)
      })
      setEmulatorServerStatus(response.ok ? 'connected' : 'disconnected')
    } catch (error) {
      setEmulatorServerStatus('disconnected')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi size={12} className="text-green-400" />
      case 'disconnected':
        return <WifiOff size={12} className="text-red-400" />
      default:
        return <AlertCircle size={12} className="text-yellow-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Checking...'
    }
  }

  return (
    <div className="h-6 bg-[#007acc] text-white text-xs flex items-center justify-between px-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Server size={12} />
          <span>File Server:</span>
          {getStatusIcon(fileServerStatus)}
          <span>{getStatusText(fileServerStatus)}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Smartphone size={12} />
          <span>Emulator Server:</span>
          {getStatusIcon(emulatorServerStatus)}
          <span>{getStatusText(emulatorServerStatus)}</span>
        </div>

        {projectRunning && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Project Running</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onTerminalToggle}
          className="hover:bg-white/10 px-2 py-1 rounded transition-colors"
        >
          Toggle Terminal
        </button>
        
        <div className="flex items-center gap-1">
          <span>Ready</span>
        </div>
      </div>
    </div>
  )
}