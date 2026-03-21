import { describe, it, expect } from 'vitest'
import {
  validateAccountId,
  validateFolder,
  validateUid,
  validatePage,
  validateBoolean,
  validateSearchCriteria,
  validateString,
  validateAttachmentIndex
} from './ipc-validators'

describe('validateAccountId', () => {
  it('accepts a valid UUID-style ID', () => {
    expect(validateAccountId('abc-123-def')).toBe('abc-123-def')
  })

  it('accepts alphanumeric IDs', () => {
    expect(validateAccountId('Account1')).toBe('Account1')
  })

  it('rejects non-string values', () => {
    expect(() => validateAccountId(123)).toThrow('non-empty string')
    expect(() => validateAccountId(null)).toThrow('non-empty string')
    expect(() => validateAccountId(undefined)).toThrow('non-empty string')
  })

  it('rejects empty string', () => {
    expect(() => validateAccountId('')).toThrow('non-empty string')
  })

  it('rejects IDs with special characters', () => {
    expect(() => validateAccountId('id with spaces')).toThrow('disallowed characters')
    expect(() => validateAccountId('id/path')).toThrow('disallowed characters')
    expect(() => validateAccountId('id\r\ninjection')).toThrow('disallowed characters')
  })

  it('rejects IDs exceeding maximum length', () => {
    expect(() => validateAccountId('a'.repeat(65))).toThrow('maximum length')
  })
})

describe('validateFolder', () => {
  it('accepts a valid folder name', () => {
    expect(validateFolder('INBOX')).toBe('INBOX')
  })

  it('accepts folder paths with delimiters', () => {
    expect(validateFolder('INBOX/Subfolder')).toBe('INBOX/Subfolder')
    expect(validateFolder('INBOX.Subfolder')).toBe('INBOX.Subfolder')
  })

  it('accepts folder names with spaces and special chars', () => {
    expect(validateFolder('My Folder')).toBe('My Folder')
    expect(validateFolder('[Gmail]/All Mail')).toBe('[Gmail]/All Mail')
  })

  it('rejects non-string values', () => {
    expect(() => validateFolder(123)).toThrow('non-empty string')
    expect(() => validateFolder(null)).toThrow('non-empty string')
  })

  it('rejects empty string', () => {
    expect(() => validateFolder('')).toThrow('non-empty string')
  })

  it('rejects folder names with CR/LF (IMAP injection)', () => {
    expect(() => validateFolder('INBOX\r\nDELETE')).toThrow('control characters')
    expect(() => validateFolder('folder\n')).toThrow('control characters')
    expect(() => validateFolder('folder\r')).toThrow('control characters')
  })

  it('rejects folder names with NUL byte', () => {
    expect(() => validateFolder('folder\x00')).toThrow('control characters')
  })

  it('rejects folder names exceeding maximum length', () => {
    expect(() => validateFolder('a'.repeat(257))).toThrow('maximum length')
  })
})

describe('validateUid', () => {
  it('accepts valid UIDs', () => {
    expect(validateUid(1)).toBe(1)
    expect(validateUid(42)).toBe(42)
    expect(validateUid(999999)).toBe(999999)
  })

  it('rejects zero', () => {
    expect(() => validateUid(0)).toThrow('positive integer')
  })

  it('rejects negative numbers', () => {
    expect(() => validateUid(-1)).toThrow('positive integer')
  })

  it('rejects non-integer numbers', () => {
    expect(() => validateUid(1.5)).toThrow('positive integer')
  })

  it('rejects non-number values', () => {
    expect(() => validateUid('1')).toThrow('positive integer')
    expect(() => validateUid(null)).toThrow('positive integer')
  })

  it('rejects UIDs exceeding IMAP range', () => {
    expect(() => validateUid(0xFFFFFFFF + 1)).toThrow('IMAP UID range')
  })
})

describe('validatePage', () => {
  it('accepts zero (first page)', () => {
    expect(validatePage(0)).toBe(0)
  })

  it('accepts positive integers', () => {
    expect(validatePage(5)).toBe(5)
  })

  it('rejects negative numbers', () => {
    expect(() => validatePage(-1)).toThrow('non-negative integer')
  })

  it('rejects non-numbers', () => {
    expect(() => validatePage('0')).toThrow('non-negative integer')
  })
})

describe('validateBoolean', () => {
  it('accepts true and false', () => {
    expect(validateBoolean(true, 'flag')).toBe(true)
    expect(validateBoolean(false, 'flag')).toBe(false)
  })

  it('rejects non-boolean values', () => {
    expect(() => validateBoolean(1, 'flag')).toThrow('must be a boolean')
    expect(() => validateBoolean('true', 'flag')).toThrow('must be a boolean')
    expect(() => validateBoolean(null, 'flag')).toThrow('must be a boolean')
  })
})

describe('validateSearchCriteria', () => {
  it('accepts empty criteria object', () => {
    expect(validateSearchCriteria({})).toEqual({})
  })

  it('accepts valid seen/flagged booleans', () => {
    const result = validateSearchCriteria({ seen: true, flagged: false })
    expect(result.seen).toBe(true)
    expect(result.flagged).toBe(false)
  })

  it('accepts valid from/subject strings', () => {
    const result = validateSearchCriteria({ from: 'user@example.com', subject: 'Test' })
    expect(result.from).toBe('user@example.com')
    expect(result.subject).toBe('Test')
  })

  it('accepts valid date fields', () => {
    const result = validateSearchCriteria({ since: '2024-01-01', before: '2024-12-31' })
    expect(result.since).toBeInstanceOf(Date)
    expect(result.before).toBeInstanceOf(Date)
  })

  it('rejects null/non-object', () => {
    expect(() => validateSearchCriteria(null)).toThrow('must be an object')
    expect(() => validateSearchCriteria('string')).toThrow('must be an object')
  })

  it('rejects non-boolean seen', () => {
    expect(() => validateSearchCriteria({ seen: 'true' })).toThrow('seen must be a boolean')
  })

  it('rejects from with control characters', () => {
    expect(() => validateSearchCriteria({ from: 'user\r\n@evil.com' })).toThrow('control characters')
  })

  it('rejects subject with control characters', () => {
    expect(() => validateSearchCriteria({ subject: 'test\x00' })).toThrow('control characters')
  })

  it('rejects invalid date values', () => {
    expect(() => validateSearchCriteria({ since: 'not-a-date' })).toThrow('valid date')
  })

  it('rejects from exceeding maximum length', () => {
    expect(() => validateSearchCriteria({ from: 'a'.repeat(257) })).toThrow('maximum length')
  })
})

describe('validateAttachmentIndex', () => {
  it('accepts zero (first attachment)', () => {
    expect(validateAttachmentIndex(0)).toBe(0)
  })

  it('accepts positive integers', () => {
    expect(validateAttachmentIndex(5)).toBe(5)
  })

  it('rejects negative numbers', () => {
    expect(() => validateAttachmentIndex(-1)).toThrow('non-negative integer')
  })

  it('rejects non-integer numbers', () => {
    expect(() => validateAttachmentIndex(1.5)).toThrow('non-negative integer')
  })

  it('rejects non-number values', () => {
    expect(() => validateAttachmentIndex('0')).toThrow('non-negative integer')
    expect(() => validateAttachmentIndex(null)).toThrow('non-negative integer')
  })

  it('rejects index exceeding maximum value', () => {
    expect(() => validateAttachmentIndex(1001)).toThrow('maximum value')
  })
})

describe('validateString', () => {
  it('accepts valid strings', () => {
    expect(validateString('hello', 'test')).toBe('hello')
  })

  it('rejects non-strings', () => {
    expect(() => validateString(123, 'test')).toThrow('must be a string')
  })

  it('rejects strings exceeding custom max length', () => {
    expect(() => validateString('toolong', 'test', 5)).toThrow('maximum length')
  })
})
