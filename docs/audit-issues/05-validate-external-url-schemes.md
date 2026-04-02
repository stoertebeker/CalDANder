# Validate external URL schemes before calling `shell.openExternal`

Suggested labels: `security`, `electron`, `hardening`
Priority: medium

## Summary

The main process currently forwards any URL received by `setWindowOpenHandler()`
to `shell.openExternal()` without validating the scheme. Electron hardening
should not rely only on renderer-side sanitation for this boundary.

## Current behavior

The code denies opening a new in-app window, but still sends the incoming URL
straight to the operating system via `shell.openExternal(url)`.

That means the main process is implicitly trusting whatever scheme arrives there.

## Why this matters

Even if the current renderer path is relatively constrained, this is still weak
defense-in-depth:

- a future renderer compromise could call `window.open()` with arbitrary URLs,
- custom protocol handlers may launch local apps or OS actions,
- `file:` and other non-web schemes should not be forwarded blindly.

For Electron apps, the safe pattern is to validate URLs again in the main
process before handing them to the OS.

## Relevant code

- `src/main/main.ts`

### Exact location

**`src/main/main.ts` — function `createWindow()`, lines 22–25**

```typescript
// Block navigation to external URLs in the window; open in system browser instead
win.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url)        // ← line 23: no scheme validation
  return { action: 'deny' }
})
```

This is the **only** call to `shell.openExternal` in the entire codebase.

## Expected behavior

Only explicitly allowed schemes should be passed to `shell.openExternal()`.

## Suggested fix

Replace **lines 22–25** in `src/main/main.ts` with:

```typescript
win.webContents.setWindowOpenHandler(({ url }) => {
  try {
    const scheme = new URL(url).protocol
    if (['https:', 'http:', 'mailto:'].includes(scheme)) {
      shell.openExternal(url)
    }
  } catch { /* malformed URL — ignore */ }
  return { action: 'deny' }
})
```

Alternatively extract a helper `isAllowedExternalUrl(url: string): boolean`
in a separate file for easier unit testing.

## Acceptance criteria

- Unsupported schemes are rejected before reaching `shell.openExternal()`.
- Allowed schemes continue to work as expected.
- The logic is covered by unit tests or an isolated helper test.
- The main-process code documents which schemes are intentionally allowed.

## Test ideas

- Accept: `https://example.com`, `http://example.com`, `mailto:user@example.com`
- Reject: `javascript:alert(1)`, `file:///C:/...`, `data:text/html,...`,
  custom protocols such as `ms-settings:`
