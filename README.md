# DuduSnack

DuduSnack is a local Expo development workspace. It combines a browser based project editor, a file server, Android emulator controls, and a live emulator preview in one interface.

<img width="1512" height="982" alt="Screenshot 2026-10-02 at 11 10 51" src="https://github.com/user-attachments/assets/4ecb0af9-9810-40ff-a9a3-c31f99d923a9" />

Create an Expo project, edit and autosave its files, install its dependencies, start an Android emulator, and open the project on that emulator from the workspace.

## Features

- Create and reopen Expo projects stored on the local machine.
- Browse project files and edit text files with line numbers and lightweight syntax highlighting.
- Autosave edits to the project directory.
- Run a limited set of development commands in a project.
- Start and stop an Android Virtual Device (AVD).
- Stream the emulator screen into the browser through ws-scrcpy.
- Start Expo Metro and open the project on the connected emulator.

## How it works

The app runs as three local services:

| Service | Port | Role |
| --- | ---: | --- |
| Next.js frontend | 3000 | Project creation screen, editor, terminal, and emulator UI |
| Files server | 3002 | Reads and writes project files, runs `npm install`, and executes allowed terminal commands |
| Emulator service | 4000 | Creates projects, lists sessions and Android AVDs, starts Expo, and manages emulator processes |
| ws-scrcpy | 8000 | Serves the emulator preview and relays screen/control traffic through ADB |
| Expo Metro | 8081 | Serves the running Expo project to the Android emulator |

The emulator and files services share project data in `files-server/sessions/<session-id>/app`. The emulator service reads and creates projects in this same directory. A session ID connects a project to its files, running Metro process, and emulator session.

### Project creation and editing

1. The frontend sends a create request to the emulator service.
2. The service runs `create-expo-app` and updates the Expo app name and package name.
3. The frontend loads the generated files from the files server and opens the workspace.
4. A blocking progress overlay stays visible while the files server runs `npm install` in the new project. A failed install can be retried from the overlay.
5. File edits are saved to the matching session directory. Generated dependencies and build output are excluded from the file browser.

### Emulator and Expo flow

1. The frontend gets installed AVD names from the emulator service.
2. Starting an emulator launches the selected AVD. The frontend polls until ADB reports it booted.
3. The emulator service starts ws-scrcpy and returns a stream URL. The frontend displays this URL in an iframe.
4. Build starts `npx expo start --lan --clear` in the project folder, waits for Metro, then uses ADB to open the Expo URL on the connected emulator.
5. Reload opens the running Expo URL on the same emulator again. Stop shuts down Expo, ws-scrcpy, and the emulator processes managed by the service.

The emulator service keeps one active emulator/session in process memory, so this is intended for one local developer at a time rather than concurrent users.

## Requirements

- macOS or Linux. The emulator service starts ws-scrcpy through `bash`.
- Node.js 20.9 or newer and npm for the frontend and services.
- Android Studio with at least one Android Virtual Device configured.
- Android SDK platform tools and emulator tools available on `PATH` (`adb` and `emulator`).
- Network access for npm and `create-expo-app` when creating projects or installing dependencies.

The emulator service uses Node 18 for ws-scrcpy when it finds an nvm installation and Node 18 installed. Otherwise, it uses the active Node version. If you use nvm, install Node 18 as well as the Node version used for the frontend.

Check the Android command line tools from a terminal:

```bash
adb version
emulator -list-avds
```

If `emulator -list-avds` returns no devices, create an AVD in Android Studio before launching the app.

## Install dependencies

Run each command from the repository root. Install dependencies in all four packages:

```bash
cd frontend && npm install
cd ../files-server && npm install
cd ../emulator-service && npm install
cd ws-scrcpy && npm install
```

Alternatively, run each block from a separate terminal, starting at the repository root:

```bash
cd frontend
npm install
```

```bash
cd files-server
npm install
```

```bash
cd emulator-service
npm install
```

```bash
cd emulator-service/ws-scrcpy
npm install
```

ws-scrcpy is built the first time an emulator stream is requested. Its `npm start` script builds the web client and starts the server on port 8000.

## Run locally

Start each service in its own terminal from the repository root.

**Terminal 1 — files server**

```bash
cd files-server
npm start
```

**Terminal 2 — emulator service**

```bash
cd emulator-service
npm start
```

The emulator service starts ws-scrcpy automatically when the first emulator stream is requested.

**Terminal 3 — frontend**

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep the files server and emulator service running while using the app.

### Optional frontend API URLs

By default, the frontend calls ports 3002 and 4000 on the same hostname used to open the browser. For a custom setup, create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_FILE_SERVER_URL=http://localhost:3002
NEXT_PUBLIC_EMULATOR_SERVER_URL=http://localhost:4000
```

Restart the Next.js dev server after changing this file. When opening the frontend from another device or hostname, configure both service URLs to addresses reachable from that browser. The Expo LAN URL and ws-scrcpy stream must also be reachable from the Android emulator and browser.

## Production frontend

Build and start the Next.js frontend with:

```bash
cd frontend
npm run build
npm start
```

The frontend production server defaults to port 3000. The files server, emulator service, Android SDK tools, and ws-scrcpy still need to be available separately.

## Project structure

```text
.
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Project creation and editor/emulator workspace
│   │   ├── globals.css        # Global styles and Tailwind import
│   │   └── layout.tsx         # Root layout and page metadata
│   ├── lib/
│   │   └── api.ts             # Browser API client for ports 3002 and 4000
│   ├── package.json
│   └── postcss.config.mjs
├── files-server/
│   ├── index.js               # Project files, install, and terminal API
│   ├── package.json
│   └── sessions/              # Generated projects, grouped by session ID
└── emulator-service/
    ├── index.js               # Project creation and Android/Expo process API
    ├── package.json
    └── ws-scrcpy/             # Bundled ws-scrcpy source and build configuration
```

Each generated project lives at:

```text
files-server/sessions/<session-id>/app/
```

The project name is stored in the generated Expo `app.json` and package metadata. The browser stores the last opened session ID in local storage so it can reopen that project on the next visit. The creation screen can also list available project sessions from disk.

## API overview

### Emulator service — port 4000

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/emulators` | List Android AVDs |
| `GET` | `/projects` | List saved Expo projects from the sessions directory |
| `POST` | `/create-expo` | Create an Expo project; expects `sessionId` and `projectName` |
| `POST` | `/start` | Start an AVD; expects `sessionId` and `emulatorName` |
| `GET` | `/stream` | Wait for the selected AVD and return its ws-scrcpy URL; expects `sessionId` and `emulatorName` query parameters |
| `POST` | `/run-expo` | Start Metro and open the project on the emulator; expects `sessionId` and `emulatorName` |
| `POST` | `/open-expo` | Reopen the running Expo URL on the connected emulator; expects `sessionId` |
| `POST` | `/stop` | Stop the emulator, Expo, and ws-scrcpy processes for the session; expects `sessionId` |

### Files server — port 3002

All routes require a valid `sessionId` in the query string or JSON body.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/get-files?sessionId=...` | Read project files |
| `PUT` | `/api/update-file` | Save a text file; expects `sessionId`, `filePath`, and `content` |
| `POST` | `/api/add-file` | Add a text file; expects `sessionId` and `filePath` |
| `DELETE` | `/api/delete-file` | Delete a project file; expects `sessionId` and `filePath` |
| `POST` | `/api/replace-files` | Replace the session's project files with a supplied files map |
| `POST` | `/api/already-exists` | Apply a supplied files map, creating the project from `boilerplate/` first if needed |
| `POST` | `/api/refresh` | Replace a session project from the optional `boilerplate/` directory |
| `POST` | `/api/install` | Run `npm install` and wait up to 10 minutes |
| `POST` | `/api/terminal` | Run an allow-listed command in the project folder |
| `GET` | `/api/processes` | List background commands for a session |
| `POST` | `/api/kill-process` | Stop a background command; expects `sessionId` and `pid` |
| `GET` | `/api/health?sessionId=...` | Check that the files server is responding |

The interactive terminal accepts a restricted set of development commands such as `npm install`, `npx expo start`, `npx expo doctor`, `ls`, and `pwd`. It rejects shell chaining and redirection characters. The routes that copy from `boilerplate/` require that directory to be supplied by the local developer; new projects created through the UI use `create-expo-app` instead.

## Useful frontend commands

```bash
cd frontend
npm run dev       # Local development server
npm run build     # Production build
npm start         # Serve the production build
npm run lint      # Run ESLint
```

## Troubleshooting

- **The project list or emulator list fails to load:** Confirm the files server and emulator service are running on ports 3002 and 4000. Restart the relevant Node service after changing its source so it loads the new routes.
- **`/projects` returns 404:** The emulator service serving port 4000 is likely an old process or was started from a different checkout. Stop it and run `npm start` from this repository's `emulator-service` directory.
- **No AVDs appear:** Create an Android Virtual Device in Android Studio and confirm `emulator -list-avds` lists it.
- **The emulator does not boot or connect:** Check that `adb devices` lists the emulator with state `device`. Also check Android SDK paths and that `adb` and `emulator` are on `PATH`.
- **The preview does not load:** ws-scrcpy is built on its first stream request and serves port 8000. Check the emulator service logs for build errors and confirm the browser can reach port 8000.
- **Expo starts but the app does not open:** Confirm Metro is ready on port 8081 and that the Android emulator can reach the host's LAN address. Firewalls, VPNs, or selecting the wrong host network interface can block Expo LAN traffic.
- **Package installation fails:** Check npm network access and the error shown in the install dialog. Retry after fixing connectivity or dependency issues.
- **A port is already in use:** Stop the process already using that port. The files server can use `PORT` to select another port; update `NEXT_PUBLIC_FILE_SERVER_URL` to match. The emulator service and ws-scrcpy currently use fixed ports 4000 and 8000.

## Security note

This is a local development tool, not a hosted multi-user service. The files server can modify project files and execute a limited set of commands, and the emulator service can start and stop local processes. The APIs do not authenticate users. Keep these services on a trusted development machine and do not expose their ports directly to the public internet.
