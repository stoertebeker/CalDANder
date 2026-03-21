import React, { useState } from 'react'
import type { AccountSummary } from '../../preload/index'
import type { MailAccount, TLSMode } from '../../main/config'

interface Props {
  accounts: AccountSummary[]
  onSave:   () => void
  onCancel: () => void
}

const EMPTY_ACCOUNT: Omit<MailAccount, 'id'> = {
  displayName:  '',
  emailAddress: '',
  imapHost:     '',
  imapPort:     993,
  imapTLS:      'implicit',
  smtpHost:     '',
  smtpPort:     465,
  smtpTLS:      'implicit',
  username:     '',
  password:     ''
}

function randomId(): string {
  return crypto.randomUUID()
}

type Tab = 'accounts' | 'ai'

export default function Settings({ accounts, onSave, onCancel }: Props): React.ReactElement {
  const [tab,       setTab]       = useState<Tab>('accounts')
  const [editing,   setEditing]   = useState<MailAccount | null>(null)
  const [testing,   setTesting]   = useState(false)
  const [testMsg,   setTestMsg]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [apiKey,    setApiKey]    = useState('')
  const [aiSaved,   setAiSaved]   = useState(false)
  const [aiSaving,  setAiSaving]  = useState(false)

  React.useEffect(() => {
    window.api.aiGetApiKey().then((k) => { if (k) setApiKey(k) })
    return () => { setApiKey('') }
  }, [])

  async function saveAiSettings(): Promise<void> {
    setAiSaving(true)
    setAiSaved(false)
    await window.api.aiSaveApiKey(apiKey)
    setApiKey('')
    setAiSaving(false)
    setAiSaved(true)
  }

  function newAccount(): void {
    setEditing({ id: randomId(), ...EMPTY_ACCOUNT })
    setTestMsg('')
    setError('')
  }

  async function testConnection(): Promise<void> {
    if (!editing) return
    setTesting(true)
    setTestMsg('')
    try {
      // Save temporarily and try listing folders
      await window.api.saveAccount(editing)
      const folders = await window.api.listFolders(editing.id)
      setTestMsg(`Connected! Found ${folders.length} folders.`)
    } catch (err) {
      setTestMsg(`Failed: ${(err as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  async function saveAccount(): Promise<void> {
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      await window.api.saveAccount(editing)
      setEditing(null)
      onSave()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function field<K extends keyof MailAccount>(key: K): {
    value:    MailAccount[K]
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  } {
    return {
      value: editing![key],
      onChange: (e) => setEditing({ ...editing!, [key]: e.target.value })
    }
  }

  function numField(key: 'imapPort' | 'smtpPort') {
    return {
      value:    editing![key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setEditing({ ...editing!, [key]: parseInt(e.target.value, 10) || 0 })
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-700 flex flex-col" style={{ background: '#1a1f2e' }}>
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-200">Settings</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-200 text-sm">← Back</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 text-sm">
          <button
            onClick={() => setTab('accounts')}
            className={`flex-1 py-2 text-center transition-colors ${tab === 'accounts' ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-gray-200'}`}
          >Accounts</button>
          <button
            onClick={() => setTab('ai')}
            className={`flex-1 py-2 text-center transition-colors ${tab === 'ai' ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-gray-200'}`}
          >AI / DAN</button>
        </div>

        {tab === 'accounts' && (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                  onClick={() => {
                    setEditing({ ...a, password: '' } as MailAccount)
                    setTestMsg('')
                    setError('')
                  }}
                >
                  <div className="font-medium text-gray-200">{a.displayName}</div>
                  <div className="text-xs text-gray-500">{a.emailAddress}</div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-700">
              <button
                onClick={newAccount}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
              >+ Add account</button>
            </div>
          </>
        )}

        {tab === 'ai' && <div className="flex-1" />}
      </div>

      {/* Editor / AI panel */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'ai' && (
          <div className="max-w-lg space-y-6">
            <h3 className="text-lg font-semibold text-gray-100">AI / DAN Mode</h3>
            <p className="text-sm text-gray-400">
              CalDANder uses the Anthropic Claude API for DAN Mode. Enter your API key below — it is stored locally on this device only.
            </p>
            <Section title="Anthropic API key">
              <Field label="API key">
                <input
                  className={inputCls}
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setAiSaved(false) }}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </Field>
              <p className="text-xs text-gray-500">
                Get your key at <span className="text-brand-400">console.anthropic.com</span>
              </p>
            </Section>
            {aiSaved && <p className="text-green-400 text-sm">API key saved.</p>}
            <button
              onClick={saveAiSettings}
              disabled={aiSaving}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {aiSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {tab === 'accounts' && !editing && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select an account to edit or add a new one.
          </div>
        )}

        {tab === 'accounts' && editing && (
          <div className="max-w-lg space-y-6">
            <h3 className="text-lg font-semibold text-gray-100">
              {accounts.find((a) => a.id === editing.id) ? 'Edit account' : 'Add account'}
            </h3>

            {/* Basic info */}
            <Section title="Identity">
              <Field label="Display name">
                <input className={inputCls} {...field('displayName')} required />
              </Field>
              <Field label="Email address">
                <input className={inputCls} type="email" {...field('emailAddress')} required />
              </Field>
            </Section>

            {/* IMAP */}
            <Section title="Incoming mail (IMAP)">
              <Field label="Host">
                <input className={inputCls} {...field('imapHost')} placeholder="imap.example.com" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Port">
                  <input className={inputCls} type="number" {...numField('imapPort')} required />
                </Field>
                <Field label="TLS mode">
                  <select className={inputCls}
                    value={editing.imapTLS}
                    onChange={(e) => setEditing({ ...editing, imapTLS: e.target.value as TLSMode })}
                  >
                    <option value="implicit">Implicit TLS (port 993)</option>
                    <option value="starttls">STARTTLS (port 143)</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* SMTP */}
            <Section title="Outgoing mail (SMTP)">
              <Field label="Host">
                <input className={inputCls} {...field('smtpHost')} placeholder="smtp.example.com" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Port">
                  <input className={inputCls} type="number" {...numField('smtpPort')} required />
                </Field>
                <Field label="TLS mode">
                  <select className={inputCls}
                    value={editing.smtpTLS}
                    onChange={(e) => setEditing({ ...editing, smtpTLS: e.target.value as TLSMode })}
                  >
                    <option value="implicit">Implicit TLS (port 465)</option>
                    <option value="starttls">STARTTLS (port 587)</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* Credentials */}
            <Section title="Credentials">
              <Field label="Username">
                <input className={inputCls} {...field('username')} autoComplete="username" required />
              </Field>
              <Field label="Password">
                <input className={inputCls} type="password" {...field('password')}
                  autoComplete="current-password"
                  placeholder={accounts.find((a) => a.id === editing.id) ? '(unchanged)' : ''}
                />
              </Field>
            </Section>

            {/* TLS notice */}
            <p className="text-xs text-gray-500 bg-gray-800 rounded p-3">
              🔒 All connections use TLS with strict certificate verification. Self-signed certificates are not accepted.
            </p>

            {/* Test result */}
            {testMsg && (
              <p className={`text-sm rounded p-2 ${testMsg.startsWith('Failed') ? 'bg-red-900/40 text-red-300' : 'bg-green-900/40 text-green-300'}`}>
                {testMsg}
              </p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={testing}
                className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              <button
                onClick={saveAccount}
                disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500'

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
