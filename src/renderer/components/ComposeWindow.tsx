import React, { useState } from 'react'
import type { FullMessage } from '../../main/imap-client'

interface Props {
  accountId: string
  replyTo?:  FullMessage
  onClose:   () => void
}

export default function ComposeWindow({ accountId, replyTo, onClose }: Props): React.ReactElement {
  const [to,      setTo]      = useState(replyTo ? extractEmail(replyTo.from) : '')
  const [cc,      setCc]      = useState('')
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '')
  const [body,    setBody]    = useState(replyTo ? `\n\n--- Original message ---\n${replyTo.textBody}` : '')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState('')

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await window.api.sendMail(accountId, {
        to:       to.split(',').map((s) => s.trim()).filter(Boolean),
        cc:       cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        subject,
        textBody: body,
        inReplyTo:  replyTo?.messageId,
        references: replyTo?.references
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
