# Snack Expo Clone

A web-based code editor inspired by Expo Snack, built with Next.js, Monaco Editor, and Tailwind CSS.

## Features

### ✅ Implemented
- **Fixed Height Layout**: Full-screen application with proper layout
- **Header**: Top navigation with branding and action buttons
- **File Explorer**: VS Code-style file tree with:
  - Create files and folders
  - Nested folder structure
  - File type icons
  - Context menus
- **Monaco Editor**: Professional code editor with:
  - Syntax highlighting
  - Auto-completion
  - Multiple tabs
  - Language detection based on file extensions
  - Dark theme
- **Preview Panel**: Preview section with:
  - Web preview (iframe)
  - Mobile device simulator
  - Switch between preview modes
  - Responsive device selection
- **Resizable Panels**: Drag to resize different sections

### 🚧 To Be Implemented
- **GitHub Import**: Import projects from GitHub repositories
- **Live Preview**: Real-time code execution and preview
- **Project Runner**: Build and run projects
- **Export/Share**: Export projects or generate shareable links
- **File Upload**: Drag and drop file uploads
- **Search**: Global search across files
- **Settings**: User preferences and editor settings

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Monaco Editor**: VS Code's editor (same engine as VS Code)
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible UI components
- **React Resizable Panels**: Resizable layout system
- **Lucide React**: Modern icon library

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Browser**
   Visit `http://localhost:3000`

## Usage

1. **Creating Files**: Click the "+" icon in the file explorer or use the context menu
2. **Editing Code**: Click on any file to open it in the editor
3. **Managing Tabs**: Switch between open files using tabs, close with the "×" button
4. **Resizing Panels**: Drag the panel borders to adjust layout
5. **Preview Modes**: Switch between web, mobile, and split view

## Architecture

The application follows a component-based architecture with React hooks for state management, in-memory file system, and Monaco Editor integration.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
