import React, { useState } from 'react'
import type { FullMessage } from '../../main/imap-client'

interface Props {
  accountId: string
  replyTo?:  FullMessage
  onClose:   () => void
}

interface Attachment {
  path: string
  name: string
  size: number
}

export default function ComposeWindow({ accountId, replyTo, onClose }: Props): React.ReactElement {
  const [to,          setTo]          = useState(replyTo ? extractEmail(replyTo.from) : '')
  const [cc,          setCc]          = useState('')
  const [subject,     setSubject]     = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '')
  const [body,        setBody]        = useState(replyTo ? `\n\n--- Original message ---\n${replyTo.textBody}` : '')
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])

  async function handleAddAttachment(): Promise<void> {
    const result = await window.api.openFileDialog()
    if (!result.canceled && result.filePaths) {
      setError('')
      const newAttachments: Attachment[] = []
      let totalSize = attachments.reduce((sum, a) => sum + a.size, 0)

      for (const path of result.filePaths) {
        const fileSize = result.fileSizes?.[result.filePaths.indexOf(path)] ?? 0
        const fileName = path.split(/[\\/]/).pop() ?? 'unknown'

        if (fileSize > 25 * 1024 * 1024) {
          setError(`Datei "${fileName}" überschreitet 25 MB Grenzwert`)
          return
        }

        totalSize += fileSize
        if (totalSize > 100 * 1024 * 1024) {
          setError('Gesamtgröße aller Anhänge überschreitet 100 MB Grenzwert')
          return
        }

        newAttachments.push({ path, name: fileName, size: fileSize })
      }

      setAttachments([...attachments, ...newAttachments])
    }
  }

  function handleRemoveAttachment(index: number): void {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSending(true)
    setError('')

    const toAddresses = parseAndValidateEmails(to)
    if (toAddresses.length === 0) {
      setError('Please enter at least one valid email address')
      setSending(false)
      return
    }

    const ccAddresses = cc ? parseAndValidateEmails(cc) : undefined
    if (cc && ccAddresses && ccAddresses.length === 0) {
      setError('CC contains no valid email addresses')
      setSending(false)
      return
    }

    try {
      await window.api.sendMail(accountId, {
        to:          toAddresses,
        cc:          ccAddresses,
        subject,
        textBody:    body,
        attachments: attachments.length > 0 ? attachments.map(a => ({ path: a.path })) : undefined,
        inReplyTo:   replyTo?.messageId,
        references:  replyTo?.references
          ? `${replyTo.references} ${replyTo.messageId}`
          : replyTo?.messageId
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h3 className="font-semibold text-gray-100">{replyTo ? 'Reply' : 'New message'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <form onSubmit={send} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-3 space-y-2 border-b border-gray-700">
            {[
              { label: 'To',      value: to,      setter: setTo      },
              { label: 'CC',      value: cc,      setter: setCc      },
              { label: 'Subject', value: subject, setter: setSubject }
            ].map(({ label, value, setter }) => (
              <div key={label} className="flex items-center gap-3">
                <label className="text-xs text-gray-400 w-12 text-right">{label}</label>
                <input
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required={label === 'To' || label === 'Subject'}
                />
              </div>
            ))}
          </div>

          <textarea
            className="flex-1 bg-gray-800 text-gray-200 text-sm px-5 py-3 resize-none focus:outline-none min-h-0"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
          />

          {/* Attachments section */}
          <div className="px-5 py-3 border-t border-gray-700 bg-gray-750 space-y-2">
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded text-xs">
                    <span className="text-gray-200 truncate">
                      {att.name} ({formatBytes(att.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddAttachment}
              disabled={sending}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded transition-colors"
            >
              + Datei anhängen
            </button>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
            {error ? <span className="text-red-400 text-xs">{error}</span> : <span />}
            <button
              type="submit"
              disabled={sending}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/)
  return match ? match[1] : addr.trim()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/** Validates that a string is a well-formed email address and contains no SMTP-injection characters. */
export function isValidEmail(email: string): boolean {
  if (/[\r\n]/.test(email)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Splits a comma-separated address string and returns only valid email addresses. */
export function parseAndValidateEmails(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean).filter(isValidEmail)
}
