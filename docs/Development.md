# Development

## Project structure

```
CalDANder/
├── src/
│   ├── main/               # Electron main process (Node.js)
│   │   ├── main.ts         # App entry point, window creation
│   │   ├── ipc-handlers.ts # IPC message handlers
│   │   ├── config.ts       # Account config load/save
│   │   ├── crypto.ts       # AES-256-GCM encryption helpers
│   │   ├── ai.ts           # Anthropic Claude API integration
│   │   ├── imap-client.ts  # IMAP operations
│   │   └── smtp-client.ts  # SMTP send
│   ├── preload/
│   │   └── index.ts        # Context bridge (renderer ↔ main)
│   └── renderer/
│       ├── components/     # React components
│       │   ├── App.tsx
│       │   ├── Unlock.tsx
│       │   ├── Sidebar.tsx
│       │   ├── MessageList.tsx
│       │   ├── MessageView.tsx
│       │   ├── ComposeWindow.tsx
│       │   └── AIPanel.tsx
│       └── styles/
│           └── globals.css
├── .github/
│   └── workflows/
│       └── build.yml       # CI: build macOS + Windows
├── docs/                   # This documentation
├── .env.example
├── electron.vite.config.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop framework | Electron 33 |
| UI framework | React 18 + TypeScript 5 |
| Build tool | electron-vite 2 + Vite |
| Styling | Tailwind CSS 3 |
| Packaging | electron-builder 25 |
| IMAP | imapflow |
| SMTP | nodemailer |
| AI | @anthropic-ai/sdk (Claude Opus 4.6) |
| HTML sanitisation | DOMPurify + jsdom |

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Compile TypeScript and bundle (no packaging) |
| `npm run build:mac` | Package macOS DMG into `release/` |
| `npm run build:win` | Package Windows NSIS installer into `release/` |
| `npm run build:linux` | Package Linux AppImage into `release/` |
| `npm run typecheck` | Run TypeScript type checker without emitting |

---

## IPC architecture

All communication between the React renderer and the Electron main process goes through a typed IPC bridge defined in `src/preload/index.ts`.

```
Renderer (React)
     │
     │  window.electron.*  (contextBridge)
     ▼
Preload (isolated context)
     │
     │  ipcRenderer.invoke(channel, ...args)
     ▼
Main process (Node.js)
     │
     ├── imap-client.ts
     ├── smtp-client.ts
     ├── crypto.ts
     ├── config.ts
     └── ai.ts
```

The renderer never touches the filesystem, network, or crypto directly.

---

## Adding a new IPC handler

1. Define the handler in `src/main/ipc-handlers.ts`:
   ```ts
   ipcMain.handle('my-channel', async (_event, arg: string) => {
     return doSomething(arg)
   })
   ```

2. Expose it through the preload bridge in `src/preload/index.ts`:
   ```ts
   myMethod: (arg: string) => ipcRenderer.invoke('my-channel', arg),
   ```

3. Call it from a React component:
   ```ts
   const result = await window.electron.myMethod('hello')
   ```

---

## CI / CD

The GitHub Actions workflow at `.github/workflows/build.yml` runs on every push and pull request. It builds:

- **macOS** on `macos-latest` → `release/*.dmg`
- **Windows** on `windows-latest` → `release/*.exe`

Artifacts are retained for 14 days and can be downloaded from the Actions tab.

Node.js 24 is used for all action runners (`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`).

---

## TypeScript configuration

The project uses composite TypeScript with separate configs for each process:

| Config | Target | Module | Used for |
|---|---|---|---|
| `tsconfig.node.json` | ES2022 | CommonJS | main + preload |
| `tsconfig.web.json` | ES2020 | ESNext | renderer |

Strict mode is enabled across all configs. Unused locals and parameters are errors.
