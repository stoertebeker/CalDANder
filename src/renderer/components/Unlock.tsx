import React, { useState, useMemo } from 'react'
import {
  validatePassphrase,
  strengthLabel,
  strengthColor,
} from '../passphrase-strength'

interface Props {
  onUnlocked: () => void
}

export default function Unlock({ onUnlocked }: Props): React.ReactElement {
  const [passphrase, setPassphrase] = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [isNew,      setIsNew]      = useState<boolean | null>(null)
  const [confirm,    setConfirm]    = useState('')

  // Live strength feedback while creating a new passphrase
  const strength = useMemo(
    () => (isNew && passphrase.length > 0 ? validatePassphrase(passphrase) : null),
    [isNew, passphrase],
  )

  // On mount, check if config exists to decide new vs unlock
  React.useEffect(() => {
    window.api.configExists().then((exists) => setIsNew(!exists))
  }, [])

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    if (isNew && passphrase !== confirm) {
      setError('Passphrases do not match')
      return
    }

    // Strong validation only when creating a new passphrase
    if (isNew) {
      const validation = validatePassphrase(passphrase)
      if (!validation.ok) {
        const msg = validation.error ?? 'Passphrase is too weak'
        const hint =
          validation.suggestions.length > 0
            ? ` ${validation.suggestions[0]}`
            : ''
        setError(`${msg}.${hint}`)
        return
      }
    }
    setLoading(true)
    try {
      const result = isNew
        ? await window.api.createConfig(passphrase)
        : await window.api.unlock(passphrase)

      if (result.ok) {
        onUnlocked()
      } else {
        setError(result.error ?? 'Failed to unlock')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isNew === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 rounded-xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand-400 mb-2">CalDANder</h1>
        <p className="text-gray-400 text-sm mb-6">
          {isNew
            ? 'Create a master passphrase to encrypt your credentials. Use 4+ random words for best security.'
            : 'Enter your master passphrase to unlock your accounts.'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {isNew ? 'New passphrase' : 'Passphrase'}
            </label>
            <input
              type="password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              required
            />
            {strength && (
              <div className="mt-1">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i < strength.score
                          ? strength.score < 3
                            ? 'bg-yellow-400'
                            : 'bg-green-400'
                          : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${strengthColor(strength.score)}`}>
                  {strengthLabel(strength.score)}
                </p>
              </div>
            )}
          </div>

          {isNew && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirm passphrase</label>
              <input
                type="password"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Please wait…' : isNew ? 'Create vault' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
