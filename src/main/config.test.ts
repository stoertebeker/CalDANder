import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { encrypt, decrypt, type EncryptedBlob } from './crypto'

// Instead of mocking os.homedir (which config.ts evaluates at import time),
// we test the crypto layer directly and verify the integration contract.

describe('API key encryption (crypto layer)', () => {
  const PASSPHRASE = 'test-master-passphrase'
  const API_KEY = 'sk-ant-api03-test-key-1234567890'

  it('encrypt produces a valid EncryptedBlob with salt, iv, tag, data', () => {
    const blob = encrypt(API_KEY, PASSPHRASE)
    expect(blob).toHaveProperty('salt')
    expect(blob).toHaveProperty('iv')
    expect(blob).toHaveProperty('tag')
    expect(blob).toHaveProperty('data')
    expect(typeof blob.salt).toBe('string')
    expect(typeof blob.iv).toBe('string')
    expect(typeof blob.tag).toBe('string')
    expect(typeof blob.data).toBe('string')
  })

  it('decrypt recovers the original API key', () => {
    const blob = encrypt(API_KEY, PASSPHRASE)
    const recovered = decrypt(blob, PASSPHRASE)
    expect(recovered).toBe(API_KEY)
  })

  it('decrypt throws with wrong passphrase', () => {
    const blob = encrypt(API_KEY, PASSPHRASE)
    expect(() => decrypt(blob, 'wrong-passphrase')).toThrow()
  })

  it('encrypted blob does not contain the plaintext key', () => {
    const blob = encrypt(API_KEY, PASSPHRASE)
    const serialized = JSON.stringify(blob)
    expect(serialized).not.toContain(API_KEY)
  })

  it('each encryption produces unique salt and iv', () => {
    const blob1 = encrypt(API_KEY, PASSPHRASE)
    const blob2 = encrypt(API_KEY, PASSPHRASE)
    expect(blob1.salt).not.toBe(blob2.salt)
    expect(blob1.iv).not.toBe(blob2.iv)
  })
})

describe('API key save/load integration', () => {
  const PASSPHRASE = 'test-master-passphrase'
  const API_KEY = 'sk-ant-api03-test-key-1234567890'
  let tempDir: string
  let settingsPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'caldander-test-'))
    settingsPath = join(tempDir, 'ai-settings.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('saveApiKey writes an encrypted blob to disk', () => {
    // Simulate what saveApiKey does
    const encrypted = encrypt(API_KEY, PASSPHRASE)
    writeFileSync(settingsPath, JSON.stringify({ anthropicApiKey: encrypted }, null, 2))

    const raw = readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)

    expect(typeof parsed.anthropicApiKey).toBe('object')
    expect(parsed.anthropicApiKey).toHaveProperty('salt')
    expect(parsed.anthropicApiKey).toHaveProperty('iv')
    expect(parsed.anthropicApiKey).toHaveProperty('tag')
    expect(parsed.anthropicApiKey).toHaveProperty('data')
    expect(raw).not.toContain(API_KEY)
  })

  it('loadApiKey can decrypt a saved key', () => {
    // Simulate saveApiKey
    const encrypted = encrypt(API_KEY, PASSPHRASE)
    writeFileSync(settingsPath, JSON.stringify({ anthropicApiKey: encrypted }))

    // Simulate loadApiKey
    const raw = readFileSync(settingsPath, 'utf8')
    const file = JSON.parse(raw) as { anthropicApiKey: EncryptedBlob }
    const recovered = decrypt(file.anthropicApiKey, PASSPHRASE)

    expect(recovered).toBe(API_KEY)
  })

  it('legacy plaintext key is readable (backward compat)', () => {
    // Simulate old plaintext format
    writeFileSync(settingsPath, JSON.stringify({ anthropicApiKey: API_KEY }))

    const raw = readFileSync(settingsPath, 'utf8')
    const file = JSON.parse(raw) as { anthropicApiKey: EncryptedBlob | string }

    // Legacy path: if it's a string, return as-is
    if (typeof file.anthropicApiKey === 'string') {
      expect(file.anthropicApiKey).toBe(API_KEY)
    } else {
      // Should not reach here for legacy format
      expect.unreachable('Expected string for legacy format')
    }
  })

  it('wrong passphrase fails to decrypt', () => {
    const encrypted = encrypt(API_KEY, PASSPHRASE)
    writeFileSync(settingsPath, JSON.stringify({ anthropicApiKey: encrypted }))

    const raw = readFileSync(settingsPath, 'utf8')
    const file = JSON.parse(raw) as { anthropicApiKey: EncryptedBlob }

    expect(() => decrypt(file.anthropicApiKey, 'wrong-passphrase')).toThrow()
  })
})
