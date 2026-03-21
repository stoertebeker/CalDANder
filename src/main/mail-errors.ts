import { auditError } from './audit-logger'

/**
 * Maps raw network / auth errors from IMAP and SMTP clients to
 * user-friendly German messages.  Technical details are logged to
 * the audit log so they remain available for debugging.
 */

interface NodeError extends Error {
  code?: string
  responseCode?: number
  command?: string
}

/** Patterns matched against error.code or error.message */
const ERROR_MAP: Array<{ test: (e: NodeError) => boolean; message: string }> = [
  // DNS resolution failed — wrong hostname
  {
    test: (e) => e.code === 'ENOTFOUND' || /getaddrinfo\s+ENOTFOUND/i.test(e.message),
    message: 'Server nicht gefunden. Bitte den Hostnamen prüfen.'
  },
  // Connection actively refused — wrong port or server not running
  {
    test: (e) => e.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(e.message),
    message: 'Verbindung abgelehnt. Bitte Host und Port prüfen.'
  },
  // Timeout while connecting
  {
    test: (e) =>
      e.code === 'ETIMEDOUT' ||
      e.code === 'ESOCKET' ||
      /ETIMEDOUT/i.test(e.message) ||
      /connect\s+ETIMEDOUT/i.test(e.message) ||
      /connection\s*timed?\s*out/i.test(e.message),
    message: 'Zeitüberschreitung bei der Verbindung. Der Server antwortet nicht.'
  },
  // TLS / certificate errors
  {
    test: (e) =>
      e.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      e.code === 'CERT_HAS_EXPIRED' ||
      e.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
      e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      e.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
      /certificate/i.test(e.message) ||
      /ssl/i.test(e.message) ||
      /ERR_TLS/i.test(e.message),
    message: 'TLS-/Zertifikatsfehler. Bitte die Verschlüsselungseinstellungen und den Hostnamen prüfen.'
  },
  // Authentication failures (IMAP + SMTP)
  {
    test: (e) =>
      e.code === 'EAUTH' ||
      e.responseCode === 535 ||
      /auth/i.test(e.code ?? '') ||
      /invalid\s*credentials/i.test(e.message) ||
      /authentication\s*failed/i.test(e.message) ||
      /login\s*failed/i.test(e.message) ||
      /incorrect/i.test(e.message),
    message: 'Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.'
  },
  // Greeting timeout — server connected but didn't respond in time
  {
    test: (e) => /greeting/i.test(e.message),
    message: 'Der Server hat nicht rechtzeitig geantwortet. Bitte Port und Verschlüsselung prüfen.'
  },
  // Socket closed unexpectedly
  {
    test: (e) =>
      e.code === 'ECONNRESET' ||
      /ECONNRESET/i.test(e.message) ||
      /socket\s*(hang\s*up|closed)/i.test(e.message),
    message: 'Verbindung zum Server unerwartet getrennt.'
  }
]

/**
 * Translate a raw error into a user-friendly message.
 * Logs the full technical details via auditError.
 *
 * @param err     The caught error
 * @param context A label for the audit log (e.g. "imap.listFolders")
 * @returns A sanitised Error whose `.message` is safe to show to the user
 */
export function toUserError(err: unknown, context: string): Error {
  const raw = err instanceof Error ? err : new Error(String(err))
  const nodeErr = raw as NodeError

  // Log full technical details for debugging
  auditError(`${context}.raw`, {
    code: nodeErr.code,
    message: nodeErr.message,
    stack: nodeErr.stack
  })

  for (const entry of ERROR_MAP) {
    if (entry.test(nodeErr)) {
      return new Error(entry.message)
    }
  }

  // Fallback — generic message, never expose raw text
  return new Error('Ein unerwarteter Fehler ist aufgetreten. Details wurden protokolliert.')
}
