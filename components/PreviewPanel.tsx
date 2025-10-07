'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Monitor, RotateCcw, ExternalLink, Settings, Play, Square, Loader2 } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import { emulatorApi } from '../lib/api'

type PreviewMode = 'android' | 'web';

interface PreviewPanelProps {
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  projectUrl?: string;
  onRunProject?: () => void;
}

export default function PreviewPanel({ previewMode, onPreviewModeChange, projectUrl, onRunProject }: PreviewPanelProps) {
  const [webUrl, setWebUrl] = useState('http://localhost:8081')
  const [emulatorUrl] = useState('http://localhost:8000/#!action=stream&udid=emulator-5554&player=mse&ws=ws%3A%2F%2Flocalhost%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3Demulator-5554')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isStartingEmulator, setIsStartingEmulator] = useState(false)
  const [emulatorRunning, setEmulatorRunning] = useState(false)
  const [availableEmulators, setAvailableEmulators] = useState<string[]>([])
  const [selectedEmulator, setSelectedEmulator] = useState('')
  const [isLaunching, setIsLaunching] = useState(false)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadAttempts, setLoadAttempts] = useState(0)
  const [maxLoadAttempts] = useState(10)

  useEffect(() => {
    loadEmulators()
  }, [])

  useEffect(() => {
    if (projectUrl) {
      setWebUrl(projectUrl)
    }
  }, [projectUrl])

  // Periodic re-rendering when launching
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isLaunching && !previewLoaded) {
      interval = setInterval(() => {
        setReloadKey(prev => prev + 1)
      }, 1000) // Re-render every 1 second
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isLaunching, previewLoaded])

  // Check when emulator starts running to begin launching state
  useEffect(() => {
    if (emulatorRunning && !previewLoaded) {
      setIsLaunching(true)
      setLoadAttempts(0)
    }
  }, [emulatorRunning, previewLoaded])

  // Reset loading state when switching modes
  useEffect(() => {
    if (previewMode === 'android') {
      // Reset loading states when switching to Android mode
      setPreviewLoaded(false)
      setReloadKey(prev => prev + 1)
      setLoadAttempts(0)
    }
  }, [previewMode])

  // Auto-retry loading if iframe fails after timeout
  useEffect(() => {
    if (isLaunching && loadAttempts < maxLoadAttempts && emulatorRunning) {
      const timeoutId = setTimeout(() => {
        if (!previewLoaded && isLaunching) {
          console.log(`Loading attempt ${loadAttempts + 1}/${maxLoadAttempts}`);
          setLoadAttempts(prev => prev + 1)
          setReloadKey(prev => prev + 1)
        }
      }, 8000) // Wait 8 seconds before retry

      return () => clearTimeout(timeoutId)
    } else if (loadAttempts >= maxLoadAttempts && !previewLoaded) {
      // Give up after max attempts and consider it loaded
      console.log('Max load attempts reached, considering preview as loaded')
      setPreviewLoaded(true)
      setIsLaunching(false)
    }
  }, [loadAttempts, isLaunching, previewLoaded, emulatorRunning, maxLoadAttempts])

  const loadEmulators = async () => {
    try {
      const emulators = await emulatorApi.getEmulators()
      setAvailableEmulators(emulators)
      if (emulators.length > 0 && !selectedEmulator) {
        setSelectedEmulator(emulators[0])
      }
    } catch (error) {
      console.error('Failed to load emulators:', error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Refresh the iframe
    const iframe = document.querySelector('iframe')
    if (iframe) {
      iframe.src = iframe.src
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const handleStartEmulator = async () => {
    const emulatorToStart = selectedEmulator || availableEmulators[0]
    if (!emulatorToStart) return
    
    setIsStartingEmulator(true)
    setPreviewLoaded(false)
    try {
      await emulatorApi.startEmulator(emulatorToStart)
      setEmulatorRunning(true)
      
      // Wait a bit for emulator to start, then open the project URL
      // setTimeout(async () => {
      //   try {
      //     if (webUrl) {
      //       await emulatorApi.openUrlInEmulator(webUrl)
      //     }
      //   } catch (error) {
      //     console.error('Failed to open URL in emulator:', error)
      //   }
      // }, 10000) // Wait 10 seconds for emulator to boot
      
    } catch (error) {
      console.error('Failed to start emulator:', error)
    } finally {
      setIsStartingEmulator(false)
    }
  }

  const handleStopEmulator = async () => {
    try {
      await emulatorApi.stopEmulator()
      setEmulatorRunning(false)
      setIsLaunching(false)
      setPreviewLoaded(false)
      setReloadKey(0)
      setLoadAttempts(0)
    } catch (error) {
      console.error('Failed to stop emulator:', error)
    }
  }

  // const handleOpenInEmulator = async () => {
  //   try {
  //     await emulatorApi.openUrlInEmulator(webUrl ?? "")
  //   } catch (error) {
  //     console.error('Failed to open URL in emulator:', error)
  //   }
  // }

  return (
    <div className="w-full h-full bg-[#252526] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#333]">
        <div className="flex items-center gap-3">
          {/* Mode Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPreviewModeChange('web')}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs transition-colors ${
                previewMode === 'web'
                  ? 'bg-white text-black'
                  : 'bg-[#494949] text-gray-300 hover:bg-[#383838]'
              }`}
            >
              <Monitor size={12} />
              Web
            </button>
            <button
              onClick={() => onPreviewModeChange('android')}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs transition-colors ${
                previewMode === 'android'
                  ? 'bg-white text-black'
                  : 'bg-[#494949] text-gray-300 hover:bg-[#383838]'
              }`}
            >
              <Smartphone size={12} />
              Android
            </button>
          </div>

          {/* Android Controls - Only show when android mode is selected */}
          {previewMode === 'android' && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[#444]">
              {!emulatorRunning ? (
                <button
                  onClick={handleStartEmulator}
                  disabled={isStartingEmulator || availableEmulators.length === 0}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-xl text-xs transition-colors"
                >
                  {isStartingEmulator ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                  Start
                </button>
              ) : (
                <button
                  onClick={handleStopEmulator}
                  className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-700 rounded-xl text-xs transition-colors"
                >
                  <Square size={10} />
                  Stop
                </button>
              )}
              
              <button
                onClick={onRunProject}
                disabled={!emulatorRunning}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-xl text-xs transition-colors"
              >
                <Play size={10} />
                Run
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-[#2d2d2d] rounded transition-colors disabled:opacity-50"
          >
            <RotateCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>



      {/* Preview Content */}
      <div className="flex-1 flex flex-col">
        {previewMode === 'web' && (
          <>
            {/* URL Input Bar */}
            <div className="p-3 border-b border-[#333]">
              <input
                type="text"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#444] rounded text-white text-sm"
                placeholder="Preview URL"
              />
            </div>
            
            {/* Web Preview Iframe - Full Height */}
            <div className="flex-1 bg-white">
              <iframe
                src={webUrl}
                className="w-full h-full border-0"
                title="Web Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </>
        )}

        {previewMode === 'android' && (
          <>
            {emulatorRunning ? (
              /* Android Emulator Iframe - Full Height */
              <div className="flex-1 android-emulator-container relative">
                {isLaunching && !previewLoaded && (
                  <div className="absolute inset-0 bg-[#000000] flex items-center justify-center z-10">
                    <div className="text-center text-white">
                      <Loader2 size={48} className="mx-auto mb-4 text-blue-400 animate-spin" />
                      <div className="text-lg font-medium mb-2">Launching</div>
                      <div className="text-sm text-gray-400 mb-2">
                        Connecting to Android emulator...
                      </div>
                      {loadAttempts > 0 && (
                        <div className="text-xs text-gray-500">
                          Attempt {loadAttempts + 1} of {maxLoadAttempts}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <iframe
                  key={`emulator-${reloadKey}`}
                  src={emulatorUrl}
                  title="Android Emulator"
                  allow="camera; microphone; fullscreen"
                  onLoad={(e) => {
                    console.log('Iframe loaded, attempt:', loadAttempts + 1);
                    // Check if iframe actually has content
                    const iframe = e.target as HTMLIFrameElement;
                    try {
                      // Try to access iframe content to verify it's actually loaded
                      const hasContent = iframe.contentWindow !== null;
                      if (hasContent) {
                        setTimeout(() => {
                          console.log('Preview considered loaded');
                          setPreviewLoaded(true);
                          setIsLaunching(false);
                          setLoadAttempts(0);
                        }, 2000); // Reduced to 2 seconds
                      }
                    } catch (error) {
                      // Cross-origin error is expected, just wait and assume loaded
                      setTimeout(() => {
                        setPreviewLoaded(true);
                        setIsLaunching(false);
                        setLoadAttempts(0);
                      }, 2000);
                    }
                  }}
                  onError={() => {
                    console.log('Iframe error, retrying...');
                    if (loadAttempts < maxLoadAttempts - 1) {
                      setTimeout(() => {
                        setReloadKey(prev => prev + 1);
                        setLoadAttempts(prev => prev + 1);
                      }, 1000);
                    }
                  }}
                />
              </div>
            ) : (
              /* Emulator Placeholder - Full Height */
              <div className="flex-1 flex items-center justify-center bg-[#000000]">
                <div className="text-center text-gray-600">
                  <Smartphone size={48} className="mx-auto mb-4 text-gray-400" />
                  <div className="text-sm font-medium mb-2">Android Emulator</div>
                  <div className="text-xs text-gray-500 mb-4">
                    Select an emulator and click Start to begin
                  </div>
                  {isStartingEmulator && (
                    <div className="text-xs text-blue-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Starting emulator...
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* QR Code / Connection Info */}
      {/* <div className="border-t border-[#333] p-3">
        <div className="text-xs text-gray-400 text-center">
          Run your project to see live preview
        </div>
      </div> */}
    </div>
  )
}