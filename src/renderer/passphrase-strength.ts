import zxcvbn from 'zxcvbn'

export interface PassphraseValidation {
  ok: boolean
  score: number          // 0–4 (zxcvbn scale)
  error: string | null
  suggestions: string[]
}

const MIN_LENGTH = 12

/**
 * Validate a new passphrase for strength.
 * Only used during passphrase *creation*, not during unlock.
 */
export function validatePassphrase(passphrase: string): PassphraseValidation {
  if (passphrase.length < MIN_LENGTH) {
    return {
      ok: false,
      score: 0,
      error: `Passphrase must be at least ${MIN_LENGTH} characters`,
      suggestions: ['Use 4+ random words for a strong passphrase.'],
    }
  }

  const result = zxcvbn(passphrase)

  if (result.score < 3) {
    const suggestions =
      result.feedback.suggestions.length > 0
        ? result.feedback.suggestions
        : ['Use 4+ random words for a strong passphrase.']

    return {
      ok: false,
      score: result.score,
      error: result.feedback.warning || 'Passphrase is too weak',
      suggestions,
    }
  }

  return {
    ok: true,
    score: result.score,
    error: null,
    suggestions: [],
  }
}

/** Human-readable label for each zxcvbn score level. */
export function strengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very weak'
    case 1:
      return 'Weak'
    case 2:
      return 'Fair'
    case 3:
      return 'Strong'
    case 4:
      return 'Very strong'
    default:
      return ''
  }
}

/** Tailwind text colour class for each score level. */
export function strengthColor(score: number): string {
  switch (score) {
    case 0:
      return 'text-red-500'
    case 1:
      return 'text-red-400'
    case 2:
      return 'text-yellow-400'
    case 3:
      return 'text-green-400'
    case 4:
      return 'text-green-300'
    default:
      return 'text-gray-400'
  }
}
