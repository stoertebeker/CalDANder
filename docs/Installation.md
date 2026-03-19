# Installation

## Pre-built binaries

Download the latest release for your platform from the [Releases](../../releases) page.

| Platform | File | Notes |
|---|---|---|
| macOS | `CalDANder-x.x.x.dmg` | Mount and drag to Applications |
| Windows | `CalDANder-Setup-x.x.x.exe` | NSIS installer |
| Linux | `CalDANder-x.x.x.AppImage` | `chmod +x` then run directly |

> **macOS note:** The app is not notarised. On first launch you may need to right-click → Open to bypass Gatekeeper.

---

## Building from source

### Prerequisites

- **Node.js** 18 or later (22 recommended)
- **npm** 9 or later
- Git

### 1. Clone the repository

```bash
git clone https://github.com/stoertebeker/CalDANder.git
cd CalDANder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

```bash
cp .env.example .env
```

Open `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The API key is only required for the DAN mode AI assistant. The app runs without it, but AI features will be unavailable.

### 4. Run in development mode

```bash
npm run dev
```

This starts electron-vite with hot module reload. Changes to renderer code are reflected instantly; changes to the main process require a restart.

### 5. Package for distribution

```bash
# macOS (produces release/*.dmg)
npm run build:mac

# Windows (produces release/*.exe)
npm run build:win

# Linux (produces release/*.AppImage)
npm run build:linux
```

Packaged binaries are written to the `release/` directory.

---

## First launch

On first launch CalDANder will ask you to create a **master passphrase**. This passphrase:

- Must be at least 8 characters
- Encrypts all stored email credentials using AES-256-GCM
- Is never written to disk — only held in memory for the current session

You will be asked to enter the passphrase every time you start the app.
