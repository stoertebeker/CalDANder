import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./audit-logger', () => ({
  auditError: vi.fn()
}))

import { toUserError } from './mail-errors'
import { auditError } from './audit-logger'

const mockedAuditError = vi.mocked(auditError)

describe('toUserError', () => {
  beforeEach(() => {
    mockedAuditError.mockClear()
  })

  it('translates ENOTFOUND to a server-not-found message', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND mail.example.com'), { code: 'ENOTFOUND' })
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Server nicht gefunden. Bitte den Hostnamen prüfen.')
  })

  it('translates ECONNREFUSED to a connection-refused message', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 1.2.3.4:993'), { code: 'ECONNREFUSED' })
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Verbindung abgelehnt. Bitte Host und Port prüfen.')
  })

  it('translates ETIMEDOUT to a timeout message', () => {
    const err = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Zeitüberschreitung bei der Verbindung. Der Server antwortet nicht.')
  })

  it('translates ESOCKET to a timeout message', () => {
    const err = Object.assign(new Error('Connection timed out'), { code: 'ESOCKET' })
    const result = toUserError(err, 'smtp.send')
    expect(result.message).toBe('Zeitüberschreitung bei der Verbindung. Der Server antwortet nicht.')
  })

  it('translates certificate errors to a TLS message', () => {
    const err = Object.assign(new Error('self signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('TLS-/Zertifikatsfehler. Bitte die Verschlüsselungseinstellungen und den Hostnamen prüfen.')
  })

  it('translates ERR_TLS_CERT_ALTNAME_INVALID', () => {
    const err = Object.assign(new Error('Hostname mismatch'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('TLS-/Zertifikatsfehler. Bitte die Verschlüsselungseinstellungen und den Hostnamen prüfen.')
  })

  it('translates EAUTH to an authentication-failed message', () => {
    const err = Object.assign(new Error('Invalid credentials'), { code: 'EAUTH' })
    const result = toUserError(err, 'smtp.send')
    expect(result.message).toBe('Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.')
  })

  it('translates "authentication failed" in message text', () => {
    const err = new Error('Authentication failed for user@example.com')
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.')
  })

  it('translates SMTP 535 response code', () => {
    const err = Object.assign(new Error('535 5.7.8 Error'), { responseCode: 535 })
    const result = toUserError(err, 'smtp.send')
    expect(result.message).toBe('Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.')
  })

  it('translates greeting timeout', () => {
    const err = new Error('Greeting timeout')
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Der Server hat nicht rechtzeitig geantwortet. Bitte Port und Verschlüsselung prüfen.')
  })

  it('translates ECONNRESET to a connection-reset message', () => {
    const err = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    const result = toUserError(err, 'imap.listFolders')
    expect(result.message).toBe('Verbindung zum Server unerwartet getrennt.')
  })

  it('translates socket hang up', () => {
    const err = new Error('socket hang up')
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Verbindung zum Server unerwartet getrennt.')
  })

  it('returns a generic message for unknown errors', () => {
    const err = new Error('Something completely unexpected happened in the Java VM')
    const result = toUserError(err, 'imap.connect')
    expect(result.message).toBe('Ein unerwarteter Fehler ist aufgetreten. Details wurden protokolliert.')
  })

  it('never leaks the original error message for unknown errors', () => {
    const err = new Error('java.lang.NullPointerException at com.sun.mail.imap.IMAPStore.connect(IMAPStore.java:123)')
    const result = toUserError(err, 'imap.connect')
    expect(result.message).not.toContain('java')
    expect(result.message).not.toContain('NullPointerException')
    expect(result.message).not.toContain('IMAPStore')
  })

  it('logs raw error details to the audit log', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND bad.host'), { code: 'ENOTFOUND' })
    toUserError(err, 'imap.connect')
    expect(mockedAuditError).toHaveBeenCalledWith('imap.connect.raw', expect.objectContaining({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND bad.host'
    }))
  })

  it('handles non-Error values gracefully', () => {
    const result = toUserError('string error', 'imap.connect')
    expect(result.message).toBe('Ein unerwarteter Fehler ist aufgetreten. Details wurden protokolliert.')
  })

  it('never includes a stack trace in the user-facing message', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:993')
    Object.assign(err, { code: 'ECONNREFUSED' })
    const result = toUserError(err, 'imap.connect')
    expect(result.stack).not.toContain('ECONNREFUSED')
    expect(result.message).not.toContain('127.0.0.1')
  })
})
