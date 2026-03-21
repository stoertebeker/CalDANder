import { describe, it, expect } from 'vitest'
import { isValidEmail, parseAndValidateEmails } from './ComposeWindow'

// ---------------------------------------------------------------------------
// isValidEmail
// ---------------------------------------------------------------------------

describe('isValidEmail', () => {
  it('accepts a standard email address', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('accepts subdomains', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })

  it('accepts plus-addressing', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true)
  })

  it('rejects an address without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects an address without domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects an address without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects an address without TLD', () => {
    expect(isValidEmail('user@example')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects whitespace-only', () => {
    expect(isValidEmail('   ')).toBe(false)
  })

  // SMTP header injection vectors
  it('rejects addresses containing \\r (carriage return)', () => {
    expect(isValidEmail('user@example.com\r')).toBe(false)
  })

  it('rejects addresses containing \\n (newline)', () => {
    expect(isValidEmail('user@example.com\nBCC: attacker@evil.com')).toBe(false)
  })

  it('rejects addresses with CRLF injection', () => {
    expect(isValidEmail('user@example.com\r\nBCC: attacker@evil.com')).toBe(false)
  })

  it('rejects addresses with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseAndValidateEmails
// ---------------------------------------------------------------------------

describe('parseAndValidateEmails', () => {
  it('parses a single valid address', () => {
    expect(parseAndValidateEmails('alice@example.com')).toEqual(['alice@example.com'])
  })

  it('parses multiple comma-separated addresses', () => {
    expect(parseAndValidateEmails('alice@example.com, bob@example.com')).toEqual([
      'alice@example.com',
      'bob@example.com'
    ])
  })

  it('trims whitespace around addresses', () => {
    expect(parseAndValidateEmails('  alice@example.com  ,  bob@example.com  ')).toEqual([
      'alice@example.com',
      'bob@example.com'
    ])
  })

  it('filters out invalid addresses', () => {
    expect(parseAndValidateEmails('alice@example.com, not-an-email, bob@example.com')).toEqual([
      'alice@example.com',
      'bob@example.com'
    ])
  })

  it('returns empty array for all-invalid input', () => {
    expect(parseAndValidateEmails('invalid, also-invalid')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseAndValidateEmails('')).toEqual([])
  })

  it('filters out SMTP injection attempts', () => {
    expect(parseAndValidateEmails('alice@example.com, evil@x.com\r\nBCC: attacker@evil.com')).toEqual([
      'alice@example.com'
    ])
  })

  it('handles trailing commas', () => {
    expect(parseAndValidateEmails('alice@example.com,')).toEqual(['alice@example.com'])
  })
})
