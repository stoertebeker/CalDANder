import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { audit, auditInfo, auditWarn, auditError, _configureForTest, _resetConfig, AuditEntry } from './audit-logger'

describe('audit-logger', () => {
  let tempDir: string
  let logPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'caldander-audit-test-'))
    logPath = join(tempDir, 'audit.log')
    _configureForTest({ logPath, configDir: tempDir })
  })

  afterEach(() => {
    _resetConfig()
    rmSync(tempDir, { recursive: true, force: true })
  })

  function readEntries(): AuditEntry[] {
    if (!existsSync(logPath)) return []
    return readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry)
  }

  it('writes a structured JSON log entry', () => {
    audit('info', 'test.event', { key: 'value' })
    const entries = readEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('info')
    expect(entries[0].event).toBe('test.event')
    expect(entries[0].details).toEqual({ key: 'value' })
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('omits details when none are provided', () => {
    audit('warn', 'no-details')
    const entries = readEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).not.toHaveProperty('details')
  })

  it('omits details when an empty object is provided', () => {
    audit('info', 'empty-details', {})
    const entries = readEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).not.toHaveProperty('details')
  })

  it('appends multiple entries', () => {
    auditInfo('event.one')
    auditWarn('event.two', { reason: 'test' })
    auditError('event.three', { code: 500 })
    const entries = readEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].level).toBe('info')
    expect(entries[1].level).toBe('warn')
    expect(entries[2].level).toBe('error')
  })

  it('creates the log directory if it does not exist', () => {
    const nestedDir = join(tempDir, 'sub', 'dir')
    const nestedLog = join(nestedDir, 'audit.log')
    _configureForTest({ logPath: nestedLog, configDir: nestedDir })
    audit('info', 'nested.test')
    expect(existsSync(nestedLog)).toBe(true)
  })

  describe('log rotation', () => {
    it('rotates the log file when it exceeds max size', () => {
      // Set a very small max size to trigger rotation
      _configureForTest({ logPath, configDir: tempDir, maxLogSize: 100 })

      // Write enough data to exceed the limit
      writeFileSync(logPath, 'x'.repeat(150))

      // Next write should trigger rotation
      audit('info', 'after-rotation')

      // Old log should be rotated to .1
      expect(existsSync(`${logPath}.1`)).toBe(true)
      // New log should contain only the new entry
      const entries = readEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].event).toBe('after-rotation')
    })

    it('shifts existing rotated files', () => {
      _configureForTest({ logPath, configDir: tempDir, maxLogSize: 100, maxRotatedFiles: 3 })

      // Simulate existing rotated files
      writeFileSync(`${logPath}.1`, 'old-rotation-1')
      writeFileSync(logPath, 'x'.repeat(150))

      audit('info', 'triggers-shift')

      // .1 should have been shifted to .2
      expect(readFileSync(`${logPath}.2`, 'utf8')).toBe('old-rotation-1')
      // Current .1 should be the previous main log
      expect(readFileSync(`${logPath}.1`, 'utf8')).toBe('x'.repeat(150))
    })
  })

  it('does not crash if the log file cannot be written', () => {
    // Point to an invalid path
    _configureForTest({ logPath: '/nonexistent/path/that/cannot/exist/audit.log', configDir: '/nonexistent/path' })
    // Should not throw
    expect(() => audit('info', 'should-not-crash')).not.toThrow()
  })
})
