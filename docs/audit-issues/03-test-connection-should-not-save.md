# Make "Test connection" non-persistent in Settings

Suggested labels: `bug`, `settings`, `ux`
Priority: medium

## Summary

The Settings screen currently persists account edits before testing the
connection. That means "Test connection" changes real stored configuration even
when the user has not clicked Save, when the test fails, or when the user later
cancels out of the editor.

## Current behavior

`testConnection()` calls the real `saveAccount()` IPC path first, then lists
folders to verify the connection.

As a result:

- Failed experiments mutate encrypted config.
- Canceling after a test does not restore the previous state.
- New accounts can be partially persisted even if the user only wanted to test
  settings.

## Why this matters

This violates normal user expectations and creates hard-to-debug config drift.
It is especially risky when testing changes on an existing account because an
unsuccessful test can still overwrite the saved host, port, username, or
password.

## Relevant code

- `src/renderer/components/Settings.tsx`
- `src/main/ipc-handlers.ts`
- `src/main/imap-client.ts`
- `src/main/config.ts`

### Exact locations

**testConnection() in Settings.tsx** — lines 61–75:

```typescript
async function testConnection(): Promise<void> {
  if (!editing) return
  setTesting(true)
  setTestMsg('')
  try {
    await window.api.saveAccount(editing)              // ← line 67: PERSISTS before testing
    const folders = await window.api.listFolders(editing.id)
    setTestMsg(`Connected! Found ${folders.length} folders.`)
  } catch (err) {
    setTestMsg(`Failed: ${(err as Error).message}`)
  } finally {
    setTesting(false)
  }
}
```

**saveAccount() in Settings.tsx** — lines 77–90 (the intentional save path):

```typescript
async function saveAccount(): Promise<void> {
  if (!editing) return
  setSaving(true)
  setError('')
  try {
    await window.api.saveAccount(editing)
    setEditing(null)
    onSave()
  } catch (err) {
    setError((err as Error).message)
  } finally {
    setSaving(false)
  }
}
```

**IPC handler `mail:save-account`** — `src/main/ipc-handlers.ts`, lines 108–126:

```typescript
ipcMain.handle('mail:save-account', async (_event, account: MailAccount) => {
  if (!masterPassphrase) throw new Error('Not unlocked')
  resetLockTimer()
  validateAccountId(account?.id)
  const idx = accounts.findIndex((a) => a.id === account.id)
  const action = idx >= 0 ? 'updated' : 'added'
  if (idx >= 0) {
    const merged = account.password
      ? account
      : { ...account, password: accounts[idx].password }
    accounts[idx] = merged
  } else {
    accounts.push(account)
  }
  saveAccounts(accounts, masterPassphrase)   // ← line 123: writes to disk
  imapClients.delete(account.id)             // ← line 124: clears IMAP cache
  auditInfo(`account.${action}`, { accountId: account.id, email: account.emailAddress })
})
```

**IPC handler `mail:list-folders`** — `src/main/ipc-handlers.ts`, lines 139–142:

```typescript
ipcMain.handle('mail:list-folders', async (_event, accountId: string) => {
  resetLockTimer()
  return getClient(validateAccountId(accountId)).listFolders()
})
```

**saveAccounts() in config.ts** — lines 50–58:

```typescript
export function saveAccounts(accounts: MailAccount[], passphrase: string): void {
  ensureConfigDir()
  const json = JSON.stringify(accounts)
  const blob = encrypt(json, passphrase)
  const file: ConfigFile = { accounts: blob }
  writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2), { mode: 0o600 })
}
```

## Expected behavior

"Test connection" should validate the currently edited values without persisting
them to disk.

## Suggested fix

**Step 1 — New IPC handler** in `src/main/ipc-handlers.ts` (after line 142):

```typescript
ipcMain.handle('mail:test-account', async (_event, account: MailAccount) => {
  if (!masterPassphrase) throw new Error('Not unlocked')
  resetLockTimer()
  validateAccountId(account?.id)
  // Temporary client — not cached, not persisted
  const tempClient = new IMAPClient(account)
  try {
    const folders = await tempClient.listFolders()
    return { ok: true, folderCount: folders.length }
  } finally {
    await tempClient.close?.()
  }
})
```

**Step 2 — Expose in preload** (`src/preload/index.ts`):

```typescript
testAccount: (account: MailAccount) => ipcRenderer.invoke('mail:test-account', account),
```

**Step 3 — Update testConnection()** in `src/renderer/components/Settings.tsx`, line 67:

Replace:
```typescript
await window.api.saveAccount(editing)
const folders = await window.api.listFolders(editing.id)
setTestMsg(`Connected! Found ${folders.length} folders.`)
```

With:
```typescript
const result = await window.api.testAccount(editing)
setTestMsg(`Connected! Found ${result.folderCount} folders.`)
```

## Acceptance criteria

- Clicking "Test connection" does not modify stored config.
- Canceling out of the editor after a test leaves persisted config unchanged.
- Existing account passwords are not accidentally overwritten during test-only
  flows.
- Successful Save still persists changes exactly once.
- Regression tests cover both "test only" and "test then cancel" scenarios.

## Test ideas

- Component test: edit account fields, click Test connection, verify no save IPC
  is called.
- Main-process test: temporary connection check succeeds or fails without
  touching config.
- Regression test: editing an existing account with blank password does not
  persist unintended changes during test-only flow.
