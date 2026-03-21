import { describe, it, expect } from 'vitest'
import {
  sanitizeEmailContext,
  stripControlChars,
  MAX_CONTEXT_LENGTH,
} from './sanitize-email-context'

// ---------------------------------------------------------------------------
// stripControlChars
// ---------------------------------------------------------------------------
describe('stripControlChars', () => {
  it('removes null bytes and low-range control characters', () => {
    expect(stripControlChars('hello\x00world\x07!')).toBe('helloworld!')
  })

  it('preserves tabs, newlines and carriage returns', () => {
    expect(stripControlChars('line1\n\tline2\r\n')).toBe('line1\n\tline2\r\n')
  })

  it('removes \x0B (vertical tab) and \x0C (form feed)', () => {
    expect(stripControlChars('a\x0Bb\x0Cc')).toBe('abc')
  })

  it('returns empty string for empty input', () => {
    expect(stripControlChars('')).toBe('')
  })

  it('leaves normal text unchanged', () => {
    const text = 'Hello World! 123 äöü'
    expect(stripControlChars(text)).toBe(text)
  })
})

// ---------------------------------------------------------------------------
// sanitizeEmailContext
// ---------------------------------------------------------------------------
describe('sanitizeEmailContext', () => {
  it('builds context string from subject and body', () => {
    const result = sanitizeEmailContext('Test Subject', 'Body text here')
    expect(result).toBe('Subject: Test Subject\n\nBody text here')
  })

  it('truncates body exceeding MAX_CONTEXT_LENGTH', () => {
    const longBody = 'x'.repeat(MAX_CONTEXT_LENGTH + 500)
    const result = sanitizeEmailContext('Subj', longBody)

    // Should contain exactly MAX_CONTEXT_LENGTH x's plus truncation marker
    expect(result).toContain('x'.repeat(MAX_CONTEXT_LENGTH))
    expect(result).toContain('[truncated...]')
    expect(result).not.toContain('x'.repeat(MAX_CONTEXT_LENGTH + 1))
  })

  it('does not truncate body at exactly MAX_CONTEXT_LENGTH', () => {
    const exactBody = 'y'.repeat(MAX_CONTEXT_LENGTH)
    const result = sanitizeEmailContext('Subj', exactBody)
    expect(result).not.toContain('[truncated...]')
    expect(result).toBe(`Subject: Subj\n\n${exactBody}`)
  })

  it('strips control characters from both subject and body', () => {
    const result = sanitizeEmailContext('Sub\x00ject', 'Bo\x07dy')
    expect(result).toBe('Subject: Subject\n\nBody')
  })

  it('handles empty subject and body', () => {
    const result = sanitizeEmailContext('', '')
    expect(result).toBe('Subject: \n\n')
  })

  it('strips control chars before measuring length for truncation', () => {
    // Body with control chars that, once stripped, is within the limit
    const padding = 'a'.repeat(MAX_CONTEXT_LENGTH - 2)
    const bodyWithControlChars = padding + '\x00\x01\x02\x03' + 'bb'
    const result = sanitizeEmailContext('S', bodyWithControlChars)
    // After stripping: padding + 'bb' = MAX_CONTEXT_LENGTH chars — no truncation
    expect(result).not.toContain('[truncated...]')
  })
})
