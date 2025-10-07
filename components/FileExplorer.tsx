'use client'

import { useState } from 'react'
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  Image as ImageIcon,
  Code,
  Settings,
  Plus,
  FolderPlus,
  MoreHorizontal
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  parent?: string;
  isOpen?: boolean;
}

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onToggleFolder: (folderId: string) => void;
}

const getFileIcon = (fileName: string, isFolder: boolean, isOpen?: boolean) => {
  if (isFolder) {
    return isOpen ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />
  }

  const extension = fileName.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <Code size={16} className="text-yellow-400" />
    case 'json':
      return <Settings size={16} className="text-yellow-600" />
    case 'css':
    case 'scss':
    case 'less':
      return <FileText size={16} className="text-blue-300" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <ImageIcon size={16} className="text-green-400" />
    case 'md':
      return <FileText size={16} className="text-blue-200" />
    default:
      return <File size={16} className="text-gray-400" />
  }
}

interface FileItemProps {
  file: FileNode;
  level: number;
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onToggleFolder: (folderId: string) => void;
}

function FileItem({ file, level, onFileSelect, onCreateFile, onCreateFolder, onToggleFolder }: FileItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState<'file' | 'folder' | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const handleCreate = (type: 'file' | 'folder') => {
    if (newItemName.trim()) {
      if (type === 'file') {
        onCreateFile(file.type === 'folder' ? file.id : file.parent || null, newItemName)
      } else {
        onCreateFolder(file.type === 'folder' ? file.id : file.parent || null, newItemName)
      }
      setNewItemName('')
      setShowCreateDialog(null)
    }
  }

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 px-2 py-1 hover:bg-[#2d2d2d] cursor-pointer group"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (file.type === 'folder') {
            onToggleFolder(file.id)
          } else {
            onFileSelect(file)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowContextMenu(true)
        }}
      >
        {getFileIcon(file.name, file.type === 'folder', file.isOpen)}
        <span className="text-sm text-gray-300 flex-1">{file.name}</span>
        {file.type === 'folder' && (
          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowCreateDialog('file')
              }}
              className="p-1 hover:bg-[#383838] rounded"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowCreateDialog('folder')
              }}
              className="p-1 hover:bg-[#383838] rounded"
            >
              <FolderPlus size={12} />
            </button>
          </div>
        )}
      </div>

      {file.type === 'folder' && file.isOpen && file.children && (
        <div>
          {file.children.map(child => (
            <FileItem
              key={child.id}
              file={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog.Root open={!!showCreateDialog} onOpenChange={() => setShowCreateDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1e1e1e] border border-[#333] rounded-lg p-6 w-80">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Create New {showCreateDialog === 'file' ? 'File' : 'Folder'}
            </Dialog.Title>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={`Enter ${showCreateDialog} name...`}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate(showCreateDialog!)
                  }
                }}
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#444] rounded text-white placeholder-gray-400"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={() => handleCreate(showCreateDialog!)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default function FileExplorer({ files, onFileSelect, onCreateFile, onCreateFolder, onToggleFolder }: FileExplorerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState<'file' | 'folder' | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const handleCreate = (type: 'file' | 'folder') => {
    if (newItemName.trim()) {
      if (type === 'file') {
        onCreateFile(null, newItemName)
      } else {
        onCreateFolder(null, newItemName)
      }
      setNewItemName('')
      setShowCreateDialog(null)
    }
  }

  return (
    <div className="h-full bg-[#252526] text-white">
      <div className="flex items-center justify-between p-3 border-b border-[#333]">
        <span className="text-sm font-medium text-gray-300 uppercase tracking-wide">Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowCreateDialog('file')}
            className="p-1 hover:bg-[#2d2d2d] rounded"
            title="New File"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowCreateDialog('folder')}
            className="p-1 hover:bg-[#2d2d2d] rounded"
            title="New Folder"
          >
            <FolderPlus size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No files yet. Create your first file or folder.
          </div>
        ) : (
          files.map(file => (
            <FileItem
              key={file.id}
              file={file}
              level={0}
              onFileSelect={onFileSelect}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onToggleFolder={onToggleFolder}
            />
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog.Root open={!!showCreateDialog} onOpenChange={() => setShowCreateDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1e1e1e] border border-[#333] rounded-lg p-6 w-80">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Create New {showCreateDialog === 'file' ? 'File' : 'Folder'}
            </Dialog.Title>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={`Enter ${showCreateDialog} name...`}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate(showCreateDialog!)
                  }
                }}
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#444] rounded text-white placeholder-gray-400"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={() => handleCreate(showCreateDialog!)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}