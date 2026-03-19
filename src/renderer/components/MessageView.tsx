import React, { useMemo } from 'react'
import type { FullMessage } from '../../main/imap-client'

// DOMPurify runs in the renderer (browser context) — safe to import here
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DOMPurify = require('dompurify') as { sanitize: (input: string, config?: object) => string }

interface Props {
  message:   FullMessage
  accountId: string
  folder:    string
  onReply:   (msg: FullMessage) => void
  onDelete:  () => void
}

export default function MessageView({ message, onReply, onDelete }: Props): React.ReactElement {
  const safeHtml = useMemo(() => {
    if (!message.htmlBody) return ''
    return DOMPurify.sanitize(message.htmlBody, {
      FORBID_TAGS:  ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR:  ['onerror', 'onload', 'onclick', 'onmouseover', 'src', 'href', 'action'],
      ALLOW_DATA_ATTR: false
    })
  }, [message.htmlBody])

  function formatDate(iso: string): string {
    return iso ? new Date(iso).toLocaleString() : ''
  }

  const body = safeHtml || message.textBody

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">{message.subject}</h2>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <span className="text-gray-500">From:</span>
          <span className="text-gray-200 truncate">{message.from}</span>
          <span className="text-gray-500">To:</span>
          <span className="text-gray-200 truncate">{message.to}</span>
          {message.cc && (
            <>
              <span className="text-gray-500">CC:</span>
              <span className="text-gray-200 truncate">{message.cc}</span>
            </>
          )}
          <span className="text-gray-500">Date:</span>
          <span className="text-gray-200">{formatDate(message.date)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onReply(message)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >Reply</button>
          <button
            onClick={onDelete}
            className="bg-red-700/60 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >Delete</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {safeHtml ? (
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{message.textBody}</pre>
        )}
      </div>

      {/* Attachments */}
      {message.attachments.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-700 flex gap-3 flex-wrap">
          {message.attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-700 rounded px-3 py-1.5 text-xs text-gray-300">
              <span>📎</span>
              <span>{att.filename}</span>
              <span className="text-gray-500">({Math.round(att.size / 1024)} KB)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
