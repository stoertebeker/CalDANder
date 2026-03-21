import { ipcMain, BrowserWindow } from 'electron'
import { loadAccounts, saveAccounts, configExists, loadApiKey, saveApiKey, MailAccount } from './config'
import { IMAPClient, SearchCriteria } from './imap-client'
import { sendMail, OutgoingMessage } from './smtp-client'
import { chat, ChatMessage } from './ai'
import {
  validateAccountId,
  validateFolder,
  validateUid,
  validatePage,
  validateBoolean,
  validateSearchCriteria,
  validateString
} from './ipc-validators'

// Master passphrase is held in memory only — never written to disk or sent to renderer.
// Cleared automatically after inactivity to limit exposure window.
let masterPassphrase: string | null = null
let accounts: MailAccount[] = []

// Cache one IMAPClient per account id for the session
const imapClients = new Map<string, IMAPClient>()

// ── Auto-lock after inactivity ────────────────────────────────────────────
const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
let lockTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Clear all sensitive state from memory and notify all renderer windows.
 */
export function lockApp(): void {
  masterPassphrase = null
  accounts = []
  imapClients.clear()
  if (lockTimer) {
    clearTimeout(lockTimer)
    lockTimer = null
  }
  // Notify every open renderer window so they return to the unlock screen
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('app:locked')
  }
}

/**
 * Reset the inactivity timer. Called on every authenticated IPC action.
 */
function resetLockTimer(): void {
  if (lockTimer) clearTimeout(lockTimer)
  if (masterPassphrase) {
    lockTimer = setTimeout(lockApp, LOCK_TIMEOUT_MS)
  }
}

function getClient(accountId: string): IMAPClient {
  const account = accounts.find((a) => a.id === accountId)
  if (!account) throw new Error(`Account ${accountId} not found`)
  if (!imapClients.has(accountId)) {
    imapClients.set(accountId, new IMAPClient(account))
  }
  return imapClients.get(accountId)!
}

export function registerIpcHandlers(): void {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('mail:config-exists', () => configExists())

  ipcMain.handle('mail:unlock', async (_event, passphrase: string) => {
    try {
      validateString(passphrase, 'passphrase')
      accounts = loadAccounts(passphrase)
      masterPassphrase = passphrase
      imapClients.clear()
      resetLockTimer()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('mail:create-config', async (_event, passphrase: string) => {
    try {
      validateString(passphrase, 'passphrase')
      saveAccounts([], passphrase)
      masterPassphrase = passphrase
      accounts = []
      resetLockTimer()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // ── Accounts ──────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-accounts', () => {
    resetLockTimer()
    return accounts.map(({ password: _pw, ...rest }) => rest)
  })

  ipcMain.handle('mail:save-account', async (_event, account: MailAccount) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    resetLockTimer()
    validateAccountId(account?.id)
    const idx = accounts.findIndex((a) => a.id === account.id)
    if (idx >= 0) {
      // Preserve existing password if a blank one was submitted (edit without password change)
      const merged = account.password
        ? account
        : { ...account, password: accounts[idx].password }
      accounts[idx] = merged
    } else {
      accounts.push(account)
    }
    saveAccounts(accounts, masterPassphrase)
    imapClients.delete(account.id)
  })

  ipcMain.handle('mail:delete-account', async (_event, accountId: string) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    resetLockTimer()
    const validId = validateAccountId(accountId)
    accounts = accounts.filter((a) => a.id !== validId)
    saveAccounts(accounts, masterPassphrase)
    imapClients.delete(validId)
  })

  // ── Folders ───────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-folders', async (_event, accountId: string) => {
    resetLockTimer()
    return getClient(validateAccountId(accountId)).listFolders()
  })

  // ── Messages ──────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-messages',
    async (_event, accountId: string, folder: string, page: number) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .listMessages(validateFolder(folder), validatePage(page), 50)
    }
  )

  ipcMain.handle('mail:fetch-message',
    async (_event, accountId: string, folder: string, uid: number) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .fetchMessage(validateFolder(folder), validateUid(uid))
    }
  )

  ipcMain.handle('mail:search',
    async (_event, accountId: string, folder: string, criteria: SearchCriteria) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .search(validateFolder(folder), validateSearchCriteria(criteria))
    }
  )

  ipcMain.handle('mail:mark-read',
    async (_event, accountId: string, folder: string, uid: number, read: boolean) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .markRead(validateFolder(folder), validateUid(uid), validateBoolean(read, 'read'))
    }
  )

  ipcMain.handle('mail:flag',
    async (_event, accountId: string, folder: string, uid: number, flagged: boolean) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .flagMessage(validateFolder(folder), validateUid(uid), validateBoolean(flagged, 'flagged'))
    }
  )

  ipcMain.handle('mail:delete',
    async (_event, accountId: string, folder: string, uid: number) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .deleteMessage(validateFolder(folder), validateUid(uid))
    }
  )

  ipcMain.handle('mail:move',
    async (_event, accountId: string, folder: string, uid: number, dest: string) => {
      resetLockTimer()
      return getClient(validateAccountId(accountId))
        .moveMessage(validateFolder(folder), validateUid(uid), validateFolder(dest))
    }
  )

  // ── Send ──────────────────────────────────────────────────────────────────
  ipcMain.handle('mail:send', async (_event, accountId: string, msg: OutgoingMessage) => {
    resetLockTimer()
    const validId = validateAccountId(accountId)
    const account = accounts.find((a) => a.id === validId)
    if (!account) throw new Error(`Account ${validId} not found`)
    await sendMail(account, msg)
  })

  // ── AI ────────────────────────────────────────────────────────────────────
  ipcMain.handle('ai:get-api-key', () => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    resetLockTimer()
    return loadApiKey(masterPassphrase)
  })

  ipcMain.handle('ai:save-api-key', (_event, key: string) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    resetLockTimer()
    validateString(key, 'API key')
    saveApiKey(key, masterPassphrase)
  })

  ipcMain.handle('ai:chat',
    async (_event, history: ChatMessage[], userMessage: string, emailContext?: string) => {
      if (!masterPassphrase) throw new Error('Not unlocked')
      resetLockTimer()
      const storedKey = loadApiKey(masterPassphrase) ?? undefined
      return chat(history, userMessage, emailContext, storedKey)
    }
  )
}
