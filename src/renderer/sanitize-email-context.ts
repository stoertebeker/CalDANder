/**
 * Maximum number of characters allowed in the email context passed to the AI.
 * ~10 000 chars ≈ 2 500 tokens — keeps API costs and latency predictable.
 */
export const MAX_CONTEXT_LENGTH = 10_000

/**
 * Strip control characters that have no business being in readable text.
 * Keeps tabs (\x09), line-feeds (\x0A) and carriage-returns (\x0D).
 */
export function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/**
 * Build a safe, bounded email context string for the AI panel.
 *
 * 1. Strips dangerous control characters from subject and body.
 * 2. Truncates the body to MAX_CONTEXT_LENGTH characters.
 */
export function sanitizeEmailContext(subject: string, textBody: string): string {
  const cleanSubject = stripControlChars(subject)
  const cleanBody = stripControlChars(textBody)

  const truncatedBody =
    cleanBody.length > MAX_CONTEXT_LENGTH
      ? cleanBody.slice(0, MAX_CONTEXT_LENGTH) + '\n\n[truncated...]'
      : cleanBody

  return `Subject: ${cleanSubject}\n\n${truncatedBody}`
}
