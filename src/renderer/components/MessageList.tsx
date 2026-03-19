import React, { useEffect, useState, useCallback } from 'react'
import type { MessageSummary } from '../../main/imap-client'

interface Props {
  accountId:   string | null
  folder:      string
  selectedUid: number | null
  onSelect:    (msg: MessageSummary) => void
}

export default function MessageList({ accountId, folder, selectedUid, onSelect }: Props): React.ReactElement {
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [page,     setPage]     = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async (p: number) => {
    if (!accountId) return
    setLoading(true)
    try {
      const list = await window.api.listMessages(accountId, folder, p)
      setMessages(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [accountId, folder])

  useEffect(() => {
    setPage(0)
    setSearch('')
    load(0)
  }, [accountId, folder, load])

  async function handleSearch(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!accountId || !search.trim()) { load(0); return }
    setLoading(true)
    try {
      const results = await window.api.search(accountId, folder, { subject: search })
      setMessages(results)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col w-72 border-r border-gray-700 h-full" style={{ background: '#1e2435' }}>
      {/* Search */}
      <form onSubmit={handleSearch} className="px-3 py-2 border-b border-gray-700">
        <input
          type="search"
          placeholder="Search subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500"
        />
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">No messages</div>
        )}
        {messages.map((msg) => (
          <button
            key={msg.uid}
            onClick={() => onSelect(msg)}
            className={`w-full text-left px-4 py-3 border-b border-gray-700 transition-colors
              ${selectedUid === msg.uid ? 'bg-brand-800/40' : 'hover:bg-gray-700/40'}`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className={`text-xs truncate ${msg.seen ? 'text-gray-400' : 'text-gray-100 font-semibold'}`}>
                {msg.from.split('<')[0].trim() || msg.from}
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(msg.date)}</span>
            </div>
            <div className={`text-sm truncate mt-0.5 ${msg.seen ? 'text-gray-400' : 'text-gray-200'}`}>
              {msg.subject}
            </div>
            <div className="flex gap-1 mt-1">
              {msg.flagged       && <span title="Flagged"     className="text-xs">⭐</span>}
              {msg.hasAttachments && <span title="Attachment" className="text-xs">📎</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between px-3 py-2 border-t border-gray-700">
        <button
          onClick={() => { const p = Math.max(0, page - 1); setPage(p); load(p) }}
          disabled={page === 0}
          className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
        >← Newer</button>
        <span className="text-xs text-gray-500">Page {page + 1}</span>
        <button
          onClick={() => { const p = page + 1; setPage(p); load(p) }}
          className="text-xs text-gray-400 hover:text-gray-200"
        >Older →</button>
      </div>
    </div>
  )
}
