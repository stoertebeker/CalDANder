import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Parse the CSP meta tag from index.html
// ---------------------------------------------------------------------------

const html = readFileSync(join(__dirname, 'index.html'), 'utf-8')
const cspMatch = html.match(/Content-Security-Policy"[\s\S]*?content="([\s\S]*?)"/)
if (!cspMatch) throw new Error('CSP meta tag not found in index.html')

const cspString = cspMatch[1].replace(/\s+/g, ' ').trim()

/** Parse CSP string into a Map of directive -> values */
function parseCSP(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const directive of csp.split(';')) {
    const parts = directive.trim().split(/\s+/)
    if (parts.length === 0 || !parts[0]) continue
    map.set(parts[0], parts.slice(1))
  }
  return map
}

const directives = parseCSP(cspString)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Content Security Policy', () => {
  it('sets default-src to none (deny by default)', () => {
    expect(directives.get('default-src')).toEqual(["'none'"])
  })

  it('allows scripts only from self', () => {
    expect(directives.get('script-src')).toEqual(["'self'"])
  })

  it('does NOT allow unsafe-inline in style-src', () => {
    const styleSrc = directives.get('style-src') ?? []
    expect(styleSrc).not.toContain("'unsafe-inline'")
    expect(styleSrc).toContain("'self'")
  })

  it('blocks object/plugin loading', () => {
    expect(directives.get('object-src')).toEqual(["'none'"])
  })

  it('blocks frame loading', () => {
    expect(directives.get('frame-src')).toEqual(["'none'"])
  })

  it('restricts base-uri to self', () => {
    expect(directives.get('base-uri')).toEqual(["'self'"])
  })

  it('blocks form submissions (form-action none)', () => {
    expect(directives.get('form-action')).toEqual(["'none'"])
  })

  it('blocks all connections', () => {
    expect(directives.get('connect-src')).toEqual(["'none'"])
  })

  it('allows fonts only from self', () => {
    expect(directives.get('font-src')).toEqual(["'self'"])
  })

  it('allows images from self, data: and blob:', () => {
    const imgSrc = directives.get('img-src') ?? []
    expect(imgSrc).toContain("'self'")
    expect(imgSrc).toContain('data:')
    expect(imgSrc).toContain('blob:')
  })
})

describe('X-Content-Type-Options header', () => {
  it('sets X-Content-Type-Options to nosniff via meta tag', () => {
    const match = html.match(/X-Content-Type-Options"[\s\S]*?content="([^"]*)"/)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('nosniff')
  })
})
