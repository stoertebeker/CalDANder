import React, { useState, useEffect } from 'react'
import Unlock from './components/Unlock'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'
import MessageList from './components/MessageList'
import MessageView from './components/MessageView'
import ComposeWindow from './components/ComposeWindow'
import AIPanel from './components/AIPanel'
import type { AccountSummary } from '../preload/index'
import type { MessageSummary, FullMessage } from '../main/imap-client'

declare global {
  interface Window {
    api: import('../preload/index').API
  }
}

type View = 'mail' | 'settings'

export default function App(): React.ReactElement {
  const [unlocked,          setUnlocked]          = useState(false)
  const [view,              setView]               = useState<View>('mail')
  const [accounts,          setAccounts]           = useState<AccountSummary[]>([])
  const [selectedAccountId, setSelectedAccountId]  = useState<string | null>(null)
  const [selectedFolder,    setSelectedFolder]     = useState<string>('INBOX')
  const [selectedMessage,   setSelectedMessage]    = useState<MessageSummary | null>(null)
  const [fullMessage,       setFullMessage]        = useState<FullMessage | null>(null)
  const [showCompose,       setShowCompose]        = useState(false)
  const [showAI,            setShowAI]             = useState(false)
  const [replyTo,           setReplyTo]            = useState<FullMessage | null>(null)

  async function refreshAccounts(): Promise<void> {
    const list = await window.api.listAccounts()
    setAccounts(list)
    if (list.length > 0 && !selectedAccountId) {
      setSelectedAccountId(list[0].id)
    }
  }

  useEffect(() => {
    if (unlocked) refreshAccounts()
  }, [unlocked])

  async function openMessage(msg: MessageSummary): Promise<void> {
    setSelectedMessage(msg)
    setFullMessage(null)
    if (!selectedAccountId) return
    const full = await window.api.fetchMessage(selectedAccountId, selectedFolder, msg.uid)
    setFullMessage(full)
    if (!msg.seen) {
      window.api.markRead(selectedAccountId, selectedFolder, msg.uid, true)
    }
  }

  function handleReply(msg: FullMessage): void {
    setReplyTo(msg)
    setShowCompose(true)
  }

  if (!unlocked) {
    return <Unlock onUnlocked={() => setUnlocked(true)} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-gray-100">
      {/* Left sidebar */}
      <Sidebar
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        selectedFolder={selectedFolder}
        onSelectAccount={setSelectedAccountId}
        onSelectFolder={setSelectedFolder}
        onCompose={() => { setReplyTo(null); setShowCompose(true) }}
        onToggleAI={() => setShowAI((v) => !v)}
        onOpenSettings={() => setView('settings')}
        aiActive={showAI}
      />

      {/* Message list */}
      <MessageList
        accountId={selectedAccountId}
        folder={selectedFolder}
        selectedUid={selectedMessage?.uid ?? null}
        onSelect={openMessage}
      />

      {/* Message view */}
      <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-700">
        {fullMessage ? (
          <MessageView
            message={fullMessage}
            accountId={selectedAccountId ?? ''}
            folder={selectedFolder}
            onReply={handleReply}
            onDelete={async () => {
              if (!selectedAccountId) return
              await window.api.deleteMessage(selectedAccountId, selectedFolder, fullMessage.uid)
              setFullMessage(null)
              setSelectedMessage(null)
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {selectedMessage ? 'Loading…' : 'Select a message'}
          </div>
        )}
      </div>

      {/* AI panel (right drawer) */}
      {showAI && (
        <AIPanel
          emailContext={fullMessage ? `Subject: ${fullMessage.subject}\n\n${fullMessage.textBody}` : undefined}
          onClose={() => setShowAI(false)}
        />
      )}

      {/* Compose modal */}
      {showCompose && selectedAccountId && (
        <ComposeWindow
          accountId={selectedAccountId}
          replyTo={replyTo ?? undefined}
          onClose={() => { setShowCompose(false); setReplyTo(null) }}
        />
      )}

      {/* Settings overlay */}
      {view === 'settings' && (
        <div className="absolute inset-0 z-50 bg-gray-900">
          <Settings
            accounts={accounts}
            onSave={async () => { await refreshAccounts(); setView('mail') }}
            onCancel={() => setView('mail')}
          />
        </div>
      )}
    </div>
  )
}
