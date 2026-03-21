import { describe, it, expect } from 'vitest'
import { validatePassphrase, strengthLabel, strengthColor } from './passphrase-strength'

describe('validatePassphrase', () => {
  it('rejects passphrases shorter than 12 characters', () => {
    const result = validatePassphrase('short')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('at least 12 characters')
    expect(result.score).toBe(0)
  })

  it('rejects an 8-character passphrase (old minimum)', () => {
    const result = validatePassphrase('12345678')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('at least 12 characters')
  })

  it('rejects a 11-character passphrase', () => {
    const result = validatePassphrase('abcdefghijk')
    expect(result.ok).toBe(false)
  })

  it('rejects a weak 12+ character passphrase like "aaaaaaaaaaaa"', () => {
    const result = validatePassphrase('aaaaaaaaaaaa')
    expect(result.ok).toBe(false)
    expect(result.score).toBeLessThan(3)
  })

  it('rejects common passwords even if long enough', () => {
    const result = validatePassphrase('passwordpassword')
    expect(result.ok).toBe(false)
    expect(result.score).toBeLessThan(3)
  })

  it('rejects "123456789012"', () => {
    const result = validatePassphrase('123456789012')
    expect(result.ok).toBe(false)
  })

  it('accepts a strong passphrase with 4+ random words', () => {
    const result = validatePassphrase('correct horse battery staple xylophone')
    expect(result.ok).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.error).toBeNull()
  })

  it('accepts a high-entropy passphrase', () => {
    const result = validatePassphrase('Tr0ub4dor&3!Px9Qm')
    expect(result.ok).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(3)
  })

  it('provides suggestions when passphrase is weak', () => {
    const result = validatePassphrase('short')
    expect(result.suggestions.length).toBeGreaterThan(0)
  })
})

describe('strengthLabel', () => {
  it('returns correct labels for all scores', () => {
    expect(strengthLabel(0)).toBe('Very weak')
    expect(strengthLabel(1)).toBe('Weak')
    expect(strengthLabel(2)).toBe('Fair')
    expect(strengthLabel(3)).toBe('Strong')
    expect(strengthLabel(4)).toBe('Very strong')
  })

  it('returns empty string for out-of-range score', () => {
    expect(strengthLabel(-1)).toBe('')
    expect(strengthLabel(5)).toBe('')
  })
})

describe('strengthColor', () => {
  it('returns red for weak scores', () => {
    expect(strengthColor(0)).toContain('red')
    expect(strengthColor(1)).toContain('red')
  })

  it('returns yellow for fair score', () => {
    expect(strengthColor(2)).toContain('yellow')
  })

  it('returns green for strong scores', () => {
    expect(strengthColor(3)).toContain('green')
    expect(strengthColor(4)).toContain('green')
  })
})
