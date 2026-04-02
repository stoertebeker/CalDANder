# Return the newest matching messages when IMAP search results exceed the cap

Suggested labels: `bug`, `imap`, `search`
Priority: medium

## Summary

Search currently truncates IMAP search results before selecting the newest
matches. If more than 200 messages match, the app keeps the oldest UIDs from the
search result set and drops the newest ones.

## Current behavior

The search path:

1. runs IMAP search,
2. receives a list of matching UIDs,
3. takes `uids.slice(0, 200)`,
4. fetches those messages,
5. reverses the final array for display.

For IMAP servers that return ascending UIDs, this means the oldest 200 matches
are fetched, not the newest 200 that users typically expect to see first.

## Why this matters

This is a user-visible correctness bug:

- Recent messages disappear from search results in large folders.
- The UI appears to work, but silently omits the most relevant matches.
- Users searching active mailboxes are most likely to notice confusing gaps.

## Relevant code

- `src/main/imap-client.ts`

### Exact location

**`src/main/imap-client.ts` — function `search()`, lines 218–246**

The bug is on **line 234**:

```typescript
// lines 231–241
const uids = await client.search(query, { uid: true })
if (uids.length === 0) return []

const range = uids.slice(0, 200).join(',')    // ← BUG: keeps oldest 200
const results: MessageSummary[] = []
for await (const msg of client.fetch(range, {
  uid: true, flags: true, envelope: true, bodyStructure: true
}, { uid: true })) {
  results.push(summarise(msg))
}
return results.reverse()
```

The `200` cap is hardcoded — no named constant exists.

The IPC entry point is in `src/main/ipc-handlers.ts`, lines 187–192:

```typescript
ipcMain.handle('mail:search',
  async (_event, accountId: string, folder: string, criteria: SearchCriteria) => {
    resetLockTimer()
    return getClient(validateAccountId(accountId))
      .search(validateFolder(folder), validateSearchCriteria(criteria))
  }
)
```

## Expected behavior

When a result cap is applied, the app should keep the newest matching messages,
then display them in a consistent order.

## Suggested fix

Change **line 234** from:

```typescript
const range = uids.slice(0, 200).join(',')
```

to:

```typescript
const range = uids.slice(-200).join(',')
```

Consider also extracting a named constant:

```typescript
const MAX_SEARCH_RESULTS = 200
const range = uids.slice(-MAX_SEARCH_RESULTS).join(',')
```

Optionally sort UIDs numerically before slicing if `imapflow` does not
guarantee ascending order.

## Acceptance criteria

- For a search result set larger than 200, the app fetches the newest matching
  messages rather than the oldest ones.
- Ordering of displayed results is deterministic and documented in code.
- Add regression coverage for large search result sets.

## Test ideas

- Unit test: search returns ascending UIDs and only newest 200 are fetched.
- Unit test: final display order matches the intended UI behavior.
- Edge-case test: exactly 200 and fewer-than-200 results still behave correctly.
