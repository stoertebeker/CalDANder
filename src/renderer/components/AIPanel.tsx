import React, { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '../../main/ai'
import { parseCalendarEvents } from '../validate-calendar-events'

interface Props {
  emailContext?: string
  onClose:       () => void
}

interface UIMessage extends ChatMessage {
  id: number
}

// Extract and render calendar JSON blocks embedded in AI responses
function renderContent(text: string): React.ReactElement {
  const parts = text.split(/(```json[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```json')) {
          const json = part.replace(/^```json\n?/, '').replace(/\n?```$/, '')
          const result = parseCalendarEvents(json)
          if (result != null) {
            if (result.tooMany) {
              return <pre key={i} className="bg-gray-900 rounded p-2 text-xs overflow-x-auto my-2 text-yellow-400">Too many events ({result.count}). Showing raw JSON instead.{'\n\n'}{json}</pre>
            }
            if (result.events.length > 0) {
              return (
                <div key={i} className="my-2 space-y-2">
                  {result.events.map((ev, j) => (
                    <div key={j} className="bg-purple-900/40 border border-purple-700 rounded p-3 text-xs">
                      <div className="font-semibold text-purple-200">{ev.title}</div>
                      <div className="text-purple-300 mt-1">
                        {new Date(ev.start).toLocaleString()} &rarr; {new Date(ev.end).toLocaleString()}
                      </div>
                      {ev.location    && <div className="text-gray-400 mt-0.5">&#x1F4CD; {ev.location}</div>}
                      {ev.description && <div className="text-gray-400 mt-0.5">{ev.description}</div>}
                    </div>
                  ))}
                </div>
              )
            }
          }
          return <pre key={i} className="bg-gray-900 rounded p-2 text-xs overflow-x-auto my-2">{json}</pre>
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })}
    </>
  )
}

export default function AIPanel({ emailContext, onClose }: Props): React.ReactElement {
  const [history,  setHistory]  = useState<UIMessage[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  let idCounter   = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: UIMessage = { id: ++idCounter.current, role: 'user', content: msg }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setLoading(true)

    try {
      const apiHistory = newHistory.map(({ role, content }) => ({ role, content }))
      const reply = await window.api.aiChat(
        apiHistory.slice(0, -1),   // history without latest user message
        msg,
        emailContext
      )
      setHistory([...newHistory, { id: ++idCounter.current, role: 'assistant', content: reply }])
    } catch (err) {
      setHistory([...newHistory, {
        id: ++idCounter.current,
        role: 'assistant',
        content: `Error: ${(err as Error).message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-96 border-l border-gray-700 h-full" style={{ background: '#1a1f2e' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="font-semibold text-purple-300">✦ DAN Mode</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {history.length === 0 && (
          <p className="text-gray-500 text-sm">
            Ask me to summarise this email, draft a reply, extract calendar events, or anything else.
          </p>
        )}
        {history.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm
              ${m.role === 'user'
                ? 'bg-brand-700 text-white'
                : 'bg-gray-700 text-gray-200'}`}
            >
              {m.role === 'assistant' ? renderContent(m.content) : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-xl px-3 py-2 text-sm text-gray-400 animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-3 py-3 border-t border-gray-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask DAN…"
          disabled={loading}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >↑</button>
      </form>
    </div>
  )
}
