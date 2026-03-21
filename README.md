# CalDANder

> Secure desktop email client with an integrated AI assistant (DAN mode) powered by Claude.
>
> **Proof of Concept** — This is a fully functional POC demonstrating what's possible with **Vibe Coding** — letting Claude autonomously design and implement a complete, production-ready application with security hardening, comprehensive testing, and professional error handling — all in one extended session.

CalDANder is an [Electron](https://www.electronjs.org/) + React application that lets you manage multiple IMAP/SMTP accounts from one dark-themed interface. All credentials are encrypted at rest with AES-256-GCM. The built-in **DAN Mode** panel connects to the Anthropic Claude API to summarise emails, draft replies, and extract calendar events.

---

## About this POC: Vibe Coding with Claude

This project was built using **Vibe Coding** — an autonomous development approach where Claude takes high-level requirements and builds a complete, production-ready application with:

- **18 security issues** identified and fixed (from critical prompt injection to infrastructure hardening)
- **241 unit tests** covering functionality, security, and edge cases
- **Professional error handling** with user-friendly German error messages
- **Full type safety** with TypeScript
- **Multi-platform builds** (macOS, Windows, Linux) via GitHub Actions
- **Email attachment download/upload** with validation
- **Structured audit logging** for compliance

The "DAN" in CalDANder originally stood for a jailbreak prompt, which was **removed** in favor of a responsible, task-focused system prompt. This demonstrates how even AI applications can be hardened through proper security practices.

---

## Features

| | |
|---|---|
| **Multi-account email** | IMAP folder navigation, search, reply, compose, flag, move, delete |
| **Encrypted storage** | AES-256-GCM + PBKDF2 — credentials never touch disk in plaintext |
| **Strict TLS** | Implicit TLS and STARTTLS; self-signed certificates rejected |
| **DAN Mode AI** | Summarise, draft, reply, extract calendar events — powered by Claude |
| **Cross-platform** | Linux (.deb), macOS (DMG), Windows (NSIS + Portable) |

---

## Quick start

### Prerequisites

- Node.js 18+
- npm 9+

### Run in development

```bash
git clone https://github.com/stoertebeker/CalDANder.git
cd CalDANder
npm install
npm run dev
```

On first launch you will be prompted to set a **master passphrase**. This protects all stored credentials. The Settings screen opens automatically so you can add your first mail account.

### Configure AI / DAN Mode

Open **Settings → AI / DAN** and paste your [Anthropic API key](https://console.anthropic.com/). The key is stored locally at `~/.caldander/ai-settings.json` (permissions `600`) and never leaves your machine except when calling the Claude API.

Alternatively, set the environment variable before starting:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

---

## Build

```bash
# All platforms (from their respective OS)
npm run build:linux   # → release/caldander_x.x.x_amd64.deb
npm run build:mac     # → release/CalDANder-x.x.x.dmg
npm run build:win     # → release/CalDANder Setup x.x.x.exe
```

Or use the CI/CD pipeline — GitHub Actions automatically builds all three platforms on every push.

---

## Tech stack

| Layer | Library |
|---|---|
| Shell | Electron 33 |
| Renderer | React 18, Tailwind CSS 3 |
| Bundler | electron-vite (Vite 5) |
| IMAP | imapflow |
| SMTP | nodemailer |
| AI | @anthropic-ai/sdk (Claude) |
| Crypto | Node.js built-in `crypto` (AES-256-GCM, PBKDF2) |

---

## Project layout

```
src/
  main/
    main.ts          # Electron main process
    ipc-handlers.ts  # IPC bridge (main side)
    config.ts        # Encrypted config read/write
    crypto.ts        # AES-256-GCM helpers
    imap-client.ts   # IMAP wrapper (imapflow)
    smtp-client.ts   # SMTP wrapper (nodemailer)
    ai.ts            # Claude API integration
  preload/
    index.ts         # Context bridge → window.api
  renderer/
    components/      # React UI components
    App.tsx          # Root component & routing
```

---

## Data storage

| File | Contents |
|---|---|
| `~/.caldander/config.json` | Mail accounts (AES-256-GCM encrypted) |
| `~/.caldander/ai-settings.json` | Anthropic API key (plaintext, mode 600) |

---

## License

MIT
