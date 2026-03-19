import React, { useEffect, useState } from 'react'
import type { AccountSummary } from '../../preload/index'
import type { Folder } from '../../main/imap-client'

interface Props {
  accounts:          AccountSummary[]
  selectedAccountId: string | null
  selectedFolder:    string
  onSelectAccount:   (id: string) => void
  onSelectFolder:    (folder: string) => void
  onCompose:         () => void
  onToggleAI:        () => void
  onOpenSettings:    () => void
  aiActive:          boolean
}

const SPECIAL_ICONS: Record<string, string> = {
  '\\Inbox':   '📥',
  '\\Sent':    '📤',
  '\\Drafts':  '📝',
  '\\Trash':   '🗑',
  '\\Junk':    '🚫',
  '\\Archive': '📦'
}

export default function Sidebar(props: Props): React.ReactElement {
  const {
    accounts, selectedAccountId, selectedFolder,
    onSelectAccount, onSelectFolder, onCompose, onToggleAI, onOpenSettings, aiActive
  } = props

  const [folders, setFolders] = useState<Folder[]>([])

  useEffect(() => {
    if (!selectedAccountId) return
    setFolders([])
    window.api.listFolders(selectedAccountId).then(setFolders).catch(console.error)
  }, [selectedAccountId])

  return (
    <div className="flex flex-col w-56 bg-gray-850 border-r border-gray-700 h-full" style={{ background: '#1a1f2e' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <span className="font-bold text-brand-400">CalDANder</span>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="text-gray-400 hover:text-gray-200 text-lg"
        >⚙</button>
      </div>

      {/* Compose button */}
      <div className="px-3 py-2">
        <button
          onClick={onCompose}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          + Compose
        </button>
      </div>

      {/* Account selector */}
      {accounts.length > 1 && (
        <div className="px-3 pb-1">
          <select
            value={selectedAccountId ?? ''}
            onChange={(e) => onSelectAccount(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded text-xs px-2 py-1 text-gray-200"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Folder tree */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {folders.map((f) => {
          const icon = f.specialUse ? (SPECIAL_ICONS[f.specialUse] ?? '📁') : '📁'
          const active = f.path === selectedFolder
          return (
            <button
              key={f.path}
              onClick={() => onSelectFolder(f.path)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2
                ${active
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <span>{icon}</span>
              <span className="truncate">{f.name}</span>
            </button>
          )
        })}
      </nav>

      {/* AI toggle */}
      <div className="px-3 py-2 border-t border-gray-700">
        <button
          onClick={onToggleAI}
          className={`w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
            ${aiActive
              ? 'bg-purple-700 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          {aiActive ? '✦ DAN Active' : '✦ DAN Mode'}
        </button>
      </div>
    </div>
  )
}
