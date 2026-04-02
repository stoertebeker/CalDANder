# Reconcile documentation and security claims with current runtime behavior

Suggested labels: `documentation`, `consistency`, `security`
Priority: low

## Summary

Multiple docs and examples no longer match the current implementation. The code
has moved forward, but README, security documentation, and environment examples
still describe older behavior.

## Mismatches found

### AI key storage and configuration

Docs currently say:

- the AI key is stored in plaintext,
- `.env` is the expected configuration path,
- the app can read `ANTHROPIC_API_KEY` from the environment.

Current code behavior:

- the AI key is encrypted at rest in `ai-settings.json`,
- the app uses the stored encrypted key path,
- the current implementation does not read `process.env.ANTHROPIC_API_KEY` for
  runtime AI access.

### Passphrase policy

Docs currently describe an 8-character minimum.
Current code enforces a 12-character minimum plus strength checks.

### Crypto parameters

Security docs still mention older PBKDF2 and salt values.
Current code uses:

- PBKDF2-HMAC-SHA256 with 600000 iterations,
- 32-byte salt,
- 12-byte IV,
- AES-256-GCM.

### HTML/CSP behavior drift

The sanitizer allows `cid:` image URLs, but the CSP currently blocks them in
`img-src`. That means the code and page policy disagree on whether embedded
message images should render.

## Why this matters

These are not just wording issues:

- security docs should be precise,
- operators may rely on incorrect setup instructions,
- future contributors may optimize around stale assumptions,
- inconsistent layered defenses are a maintenance smell.

## Relevant files with exact locations

### AI key storage

| What | File | Line | Value |
|------|------|------|-------|
| Doc claim | `README.md` | 122 | `ai-settings.json` — "plaintext, mode 600" |
| Code reality | `src/main/config.ts` | 85–89 | `encrypt(key, passphrase)` → **encrypted** |

```typescript
// config.ts:85-89
export function saveApiKey(key: string, passphrase: string): void {
  ensureConfigDir()
  const encrypted = encrypt(key, passphrase)  // ← encrypted, not plaintext
  writeFileSync(AI_SETTINGS_PATH, JSON.stringify({ anthropicApiKey: encrypted }, null, 2), { mode: 0o600 })
}
```

### Passphrase policy

| What | File | Line | Value |
|------|------|------|-------|
| Doc claim | `docs/Configuration.md` | 99 | "Minimum 8 characters" |
| Code reality | `src/renderer/passphrase-strength.ts` | 10 | `const MIN_LENGTH = 12` |

### Crypto parameters

| Parameter | Doc (`docs/Security.md`) | Doc line | Code (`src/main/crypto.ts`) | Code line | Match? |
|-----------|--------------------------|----------|-----------------------------|-----------|--------|
| PBKDF2 iterations | 310 000 | 18 | `600_000` | 9 | MISMATCH |
| Salt size | 16 bytes | 19 | `32` bytes | 12 | MISMATCH |
| IV size | 12 bytes | 20 | `12` bytes | 13 | OK |

```typescript
// crypto.ts:9,12-13
export const PBKDF2_ITERATIONS = 600_000  // docs say 310_000
const SALT_BYTES = 32                     // docs say 16
const IV_BYTES = 12                       // docs correct
```

### CSP vs Sanitizer

| What | File | Line | Value |
|------|------|------|-------|
| CSP img-src | `src/renderer/index.html` | 11 | `img-src 'self' data: blob:` (no `cid:`) |
| Sanitizer | `src/renderer/sanitize-html.ts` | 32 | `SAFE_URL_PATTERN` allows `cid:` |

```typescript
// sanitize-html.ts:32
export const SAFE_URL_PATTERN = /^(?:https?:|mailto:|cid:|data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,)/i
//                                                     ^^^^ allowed by sanitizer, blocked by CSP
```

```html
<!-- index.html:11 -->
img-src 'self' data: blob:;
<!-- cid: NOT listed — images will be sanitized through but blocked at load time -->
```

## Expected behavior

Documentation, examples, and layered policy should reflect the actual runtime
behavior.

## Suggested fixes

1. **README.md:122** — Change "plaintext" to "encrypted with master passphrase"
2. **docs/Configuration.md:99** — Change "8 characters" to "12 characters"
3. **docs/Security.md:18** — Change "310 000" to "600 000"
4. **docs/Security.md:19** — Change "16 bytes" to "32 bytes"
5. **CSP/Sanitizer alignment** — Decide one of:
   - **Option A:** Add `cid:` to CSP `img-src` in `src/renderer/index.html:11`
   - **Option B:** Remove `cid:` from `SAFE_URL_PATTERN` in `src/renderer/sanitize-html.ts:32`
6. **`.env.example`** — Remove or update `ANTHROPIC_API_KEY` reference if env-based config is no longer supported

## Acceptance criteria

- README and docs accurately describe current AI key handling.
- `.env.example` is either removed, repurposed, or made truthful.
- Security docs match the actual crypto settings in code.
- Passphrase guidance matches the enforced validation rules.
- Sanitizer and CSP agree on whether `cid:` image URLs are allowed.
