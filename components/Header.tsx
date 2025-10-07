'use client'

import { useState } from 'react'
import { Github, Play, Settings, Download, Share2, User } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatedGradientText } from './ui/animated-gradient-text';

interface HeaderProps {
  onGithubImport: () => void;
  onRunProject: () => void;
}

export default function Header({ onGithubImport, onRunProject }: HeaderProps) {
  const [showGithubDialog, setShowGithubDialog] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');

  const handleGithubImport = () => {
    if (githubUrl.trim()) {
      onGithubImport();
      setGithubUrl('');
      setShowGithubDialog(false);
    }
  };

  return (
    <header className="h-14 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between px-4 text-white">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center font-bold text-sm">
            S
          </div> */}
          <span className="font-bold text-lg"><AnimatedGradientText>DuduSnack</AnimatedGradientText></span>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog.Root open={showGithubDialog} onOpenChange={setShowGithubDialog}>
            <Dialog.Trigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#383838] rounded-xl text-sm transition-colors">
                <Github size={16} />
                Import from GitHub
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/50" />
              <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1e1e1e] border border-[#333] rounded-lg p-6 w-96">
                <Dialog.Title className="text-lg font-semibold mb-4">Import GitHub Repository</Dialog.Title>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="https://github.com/username/repository"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#444] rounded text-white placeholder-gray-400"
                  />
                  <div className="flex gap-2 justify-end">
                    <Dialog.Close asChild>
                      <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={handleGithubImport}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* <button
          onClick={onRunProject}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
        >
          <Play size={16} />
          Run
        </button> */}
        
        <button className="p-2 hover:bg-[#2d2d2d] rounded transition-colors">
          <Share2 size={18} />
        </button>
        
        <button className="p-2 hover:bg-[#2d2d2d] rounded transition-colors">
          <Download size={18} />
        </button>
        
        <button className="p-2 hover:bg-[#2d2d2d] rounded transition-colors">
          <Settings size={18} />
        </button>
        
        <button className="p-2 hover:bg-[#2d2d2d] rounded transition-colors">
          <User size={18} />
        </button>
      </div>
    </header>
  )
}