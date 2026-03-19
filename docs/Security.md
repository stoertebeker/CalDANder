# Security

CalDANder is designed with a security-first approach. No credentials are ever sent to third-party services, and all sensitive data is encrypted at rest.

---

## Credential encryption

### At-rest encryption

All email passwords are encrypted before being written to disk using:

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key derivation | PBKDF2 |
| Hash | SHA-256 |
| Iterations | 310 000 |
| Salt | 16 bytes, randomly generated per account |
| IV | 12 bytes, randomly generated per encryption |
| Auth tag | 16 bytes (GCM authentication tag) |

The derived key is used only in memory and discarded after use. The stored ciphertext, salt, and IV are all that are written to `~/.caldander/config.json`.

### Master passphrase

The master passphrase is the user-supplied secret that feeds into PBKDF2 to derive the encryption key. It is:

- **Never written to disk** in any form
- **Never sent** to any remote service
- Held in the Electron main process memory only
- Cleared when the app exits

---

## Network security

### TLS enforcement

CalDANder uses strict TLS verification for all outbound connections:

- **IMAP:** imapflow with `rejectUnauthorized: true` — self-signed certificates are rejected
- **SMTP:** nodemailer with `rejectUnauthorized: true` — self-signed certificates are rejected

Both implicit TLS (port 993/465) and STARTTLS (port 143/587) are supported.

### No telemetry

CalDANder makes no outbound connections other than:

1. Your configured IMAP servers (fetching mail)
2. Your configured SMTP servers (sending mail)
3. Anthropic's API — only when DAN mode is active and you send a message

---

## Electron security model

| Setting | Value | Purpose |
|---|---|---|
| `nodeIntegration` | `false` | Renderer cannot access Node.js APIs directly |
| `contextIsolation` | `true` | Preload script runs in an isolated context |
| `sandbox` | `true` | Renderer is sandboxed like a normal browser tab |

All communication between the renderer (React UI) and the main process (Node.js backend) goes through the IPC bridge defined in the preload script. The renderer never has direct access to the file system, network, or crypto modules.

### HTML sanitisation

Incoming email HTML is sanitised with [DOMPurify](https://github.com/cure53/DOMPurify) before rendering, preventing XSS from malicious email content.

---

## Data stored on disk

| Location | Contents | Protection |
|---|---|---|
| `~/.caldander/config.json` | Encrypted account credentials | AES-256-GCM, file mode 0600 |
| `.env` | Anthropic API key | Plain text — keep this file private |

The `.env` file is not packaged into production builds. In distributed binaries, the API key must be set via a system environment variable.

---

## Threat model

CalDANder protects against:

- **Disk theft / unauthorised filesystem access** — credentials are encrypted at rest
- **Process inspection** — the master passphrase is not in any file; IMAP/SMTP passwords are decrypted only when needed
- **Malicious email content** — HTML is sanitised before rendering

CalDANder does **not** protect against:

- A compromised or malicious operating system
- An attacker with live access to your running session (the passphrase is in memory)
- Weak master passphrases
