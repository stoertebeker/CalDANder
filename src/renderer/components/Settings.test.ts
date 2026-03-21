import { describe, it, expect } from 'vitest'

describe('randomId – crypto.randomUUID() usage', () => {
  it('crypto.randomUUID produces a valid UUID v4 format', () => {
    const id = crypto.randomUUID()
    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('crypto.randomUUID produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()))
    expect(ids.size).toBe(100)
  })

  it('crypto.randomUUID is available (not undefined)', () => {
    expect(typeof crypto.randomUUID).toBe('function')
  })
})
