# CalDANder

CalDANder is a secure, privacy-focused desktop email client with an integrated AI assistant (DAN mode) powered by Claude. Built with Electron and React, it keeps all your credentials encrypted on your local machine while giving you a fast, keyboard-friendly interface for managing multiple email accounts.

---

## Features at a glance

| Category | Details |
|---|---|
| **Email** | Multi-account IMAP/SMTP, folder navigation, search, reply, compose, flag, move, delete |
| **Security** | AES-256-GCM encryption at rest, PBKDF2 key derivation, strict TLS for all connections |
| **AI assistant** | Summarise emails, draft replies, extract calendar events, free-form chat |
| **UI** | Dark theme, paginated message list, threaded replies, sliding AI panel |

---

## Quick start

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- An Anthropic API key (for DAN mode)

### Install and run in development mode

```bash
git clone https://github.com/stoertebeker/CalDANder.git
cd CalDANder
npm install
cp .env.example .env          # then add your ANTHROPIC_API_KEY
npm run dev
```

The app will launch and prompt you to set a **master passphrase** on first run. This passphrase protects all stored email credentials.

---

## Documentation pages

- [Installation](Installation.md) — pre-built binaries, building from source
- [Configuration](Configuration.md) — adding accounts, environment variables, file locations
- [Features](Features.md) — email management, DAN mode AI assistant, calendar extraction
- [Security](Security.md) — encryption details, TLS, credential storage
- [Development](Development.md) — project structure, build commands, contributing
