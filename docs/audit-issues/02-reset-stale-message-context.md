# Reset stale message state when switching account or folder

Suggested labels: `bug`, `ui`, `state-management`
Priority: medium

## Summary

The app keeps rendering the previously opened message after the user switches
account or folder. Follow-up actions then use the new mailbox context together
with the old message UID, which can target the wrong message or fail
unpredictably.

## Current behavior

Example flow:

1. Open a message in account A / folder INBOX.
2. Switch to account B or a different folder.
3. The message pane still shows the old message body.
4. Click Delete or download an attachment.

The app now sends the current `accountId` and `folder`, but the old `uid`.

## Why this matters

This is a correctness bug with potentially destructive side effects:

- Delete may affect the wrong mailbox context.
- Attachment download may fail or download content from the wrong message.
- Reply UI may be built from stale content.
- The visible message no longer matches the active account/folder shown in the
  rest of the UI.

## Relevant code

- `src/renderer/App.tsx`
- `src/renderer/components/MessageView.tsx`
- `src/renderer/components/MessageList.tsx`

### Exact locations

**State definitions** — `src/renderer/App.tsx`, lines 27–28:

```typescript
const [selectedMessage,   setSelectedMessage]    = useState<MessageSummary | null>(null)
const [fullMessage,       setFullMessage]        = useState<FullMessage | null>(null)
```

**Account/folder switch handlers** — `src/renderer/App.tsx`, lines 89–92:

```typescript
<Sidebar
  accounts={accounts}
  selectedAccountId={selectedAccountId}
  selectedFolder={selectedFolder}
  onSelectAccount={setSelectedAccountId}   // ← no message state cleanup
  onSelectFolder={setSelectedFolder}       // ← no message state cleanup
```

**Proper cleanup pattern already exists** (on lock) — lines 49–62:

```typescript
useEffect(() => {
  const unsubscribe = window.api.onLocked(() => {
    setUnlocked(false)
    setAccounts([])
    setSelectedAccountId(null)
    setSelectedMessage(null)        // ← properly cleared here
    setFullMessage(null)            // ← properly cleared here
    setShowCompose(false)
    setShowAI(false)
    setReplyTo(null)
    setView('mail')
  })
  return unsubscribe
}, [])
```

**Destructive action using stale UID** — `src/renderer/App.tsx`, lines 115–120:

```typescript
onDelete={async () => {
  if (!selectedAccountId) return
  await window.api.deleteMessage(selectedAccountId, selectedFolder, fullMessage.uid)
  setFullMessage(null)
  setSelectedMessage(null)
}}
```

**Attachment download using stale context** — `src/renderer/components/MessageView.tsx`, lines 23–29:

```typescript
const handleDownloadAttachment = useCallback(async (attachmentIndex: number) => {
  try {
    await window.api.downloadAttachment(accountId, folder, message.uid, attachmentIndex)
  } catch (err) {
    console.error('Failed to download attachment:', err)
  }
}, [accountId, folder, message.uid])
```

## Expected behavior

Changing account or folder should invalidate message selection state unless the
selected message is intentionally reloaded in the new context.

## Suggested fix

Add a `useEffect` in `src/renderer/App.tsx` (after line 28) that clears
message state when account or folder changes:

```typescript
useEffect(() => {
  setSelectedMessage(null)
  setFullMessage(null)
}, [selectedAccountId, selectedFolder])
```

This follows the same pattern already used in the `onLocked` handler
(lines 54–55).

## Acceptance criteria

- Switching account clears the message pane or reloads a message that belongs to
  the new account.
- Switching folder clears the message pane or reloads a message that belongs to
  the new folder.
- Delete, download attachment, and reply cannot operate on stale message state.
- Add regression coverage for account/folder switches after a message has been
  opened.

## Test ideas

- Component test: open a message, switch folders, verify message pane resets.
- Component test: open a message, switch accounts, verify actions are disabled
  or rebound correctly.
- Integration-style UI test for delete/download after a context switch.
