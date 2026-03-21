import DOMPurify from 'dompurify'

export const ALLOWED_TAGS = [
  // Text formatting
  'b', 'i', 'em', 'strong', 'u', 's', 'small', 'sub', 'sup', 'mark',
  // Structure
  'p', 'br', 'div', 'span', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  // Quoting / code
  'blockquote', 'pre', 'code',
  // Links & images (attributes validated via hook)
  'a', 'img',
  // Description lists
  'dl', 'dt', 'dd',
  // Misc inline
  'abbr', 'cite', 'dfn', 'kbd', 'q', 'var', 'wbr',
]

export const ALLOWED_ATTR = [
  'class', 'id', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'scope', 'headers',
  'dir', 'lang',
  // href and src are allowed but validated by the hook below
  'href', 'src', 'target', 'rel',
]

export const SAFE_URL_PATTERN = /^(?:https?:|mailto:|cid:|data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,)/i

/**
 * DOMPurify hook: validate href/src to only allow safe URL schemes.
 * Removes the attribute if it does not match the safe pattern.
 */
function configureSanitizer(): typeof DOMPurify {
  const purify = DOMPurify
  purify.addHook('afterSanitizeAttributes', (node) => {
    // Force all links to open safely
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer nofollow')
      node.setAttribute('target', '_blank')

      const href = node.getAttribute('href') || ''
      if (href && !SAFE_URL_PATTERN.test(href)) {
        node.removeAttribute('href')
      }
    }

    // Validate img src
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') || ''
      if (src && !SAFE_URL_PATTERN.test(src)) {
        node.removeAttribute('src')
      }
    }
  })
  return purify
}

const purifier = configureSanitizer()

/**
 * Sanitize untrusted HTML (e.g. email bodies) using a strict whitelist approach.
 * Only safe tags, attributes, and URL schemes are kept.
 */
export function sanitizeHtml(html: string): string {
  return purifier.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT:    true,
  })
}
