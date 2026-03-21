import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { encrypt, decrypt, EncryptedBlob } from './crypto'

export type TLSMode = 'implicit' | 'starttls'

export interface MailAccount {
  id: string
  displayName: string
  emailAddress: string
  imapHost: string
  imapPort: number
  imapTLS: TLSMode
  smtpHost: string
  smtpPort: number
  smtpTLS: TLSMode
  username: string
  password: string  // decrypted — never written to disk in plaintext
}

interface ConfigFile {
  accounts: EncryptedBlob
}

const CONFIG_DIR  = join(homedir(), '.caldander')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

export function loadAccounts(passphrase: string): MailAccount[] {
  ensureConfigDir()
  if (!existsSync(CONFIG_PATH)) return []

  const raw = readFileSync(CONFIG_PATH, 'utf8')
  const file: ConfigFile = JSON.parse(raw)

  try {
    const json = decrypt(file.accounts, passphrase)
    return JSON.parse(json) as MailAccount[]
  } catch {
    throw new Error('Incorrect passphrase or corrupted config file')
  }
}

export function saveAccounts(accounts: MailAccount[], passphrase: string): void {
  ensureConfigDir()

  const json = JSON.stringify(accounts)
  const blob = encrypt(json, passphrase)
  const file: ConfigFile = { accounts: blob }

  writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2), { mode: 0o600 })
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH)
}

const AI_SETTINGS_PATH = join(CONFIG_DIR, 'ai-settings.json')

export function loadApiKey(passphrase: string): string | null {
  if (!existsSync(AI_SETTINGS_PATH)) return null
  try {
    const raw = readFileSync(AI_SETTINGS_PATH, 'utf8')
    const file = JSON.parse(raw) as { anthropicApiKey?: EncryptedBlob | string }
    if (!file.anthropicApiKey) return null

    // Handle encrypted blob (new format)
    if (typeof file.anthropicApiKey === 'object' && 'salt' in file.anthropicApiKey) {
      return decrypt(file.anthropicApiKey, passphrase)
    }

    // Legacy plaintext format — read it but it will be re-encrypted on next save
    return file.anthropicApiKey as string
  } catch {
    return null
  }
}

export function saveApiKey(key: string, passphrase: string): void {
  ensureConfigDir()
  const encrypted = encrypt(key, passphrase)
  writeFileSync(AI_SETTINGS_PATH, JSON.stringify({ anthropicApiKey: encrypted }, null, 2), { mode: 0o600 })
}
