import { ipcMain } from 'electron'
import { loadAccounts, saveAccounts, configExists, MailAccount } from './config'
import { IMAPClient, SearchCriteria } from './imap-client'
import { sendMail, OutgoingMessage } from './smtp-client'
import { chat, ChatMessage } from './ai'

// Master passphrase is held in memory only — never written to disk or sent to renderer
let masterPassphrase: string | null = null
let accounts: MailAccount[] = []

// Cache one IMAPClient per account id for the session
const imapClients = new Map<string, IMAPClient>()

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
      accounts = loadAccounts(passphrase)
      masterPassphrase = passphrase
      imapClients.clear()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('mail:create-config', async (_event, passphrase: string) => {
    try {
      saveAccounts([], passphrase)
      masterPassphrase = passphrase
      accounts = []
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // ── Accounts ──────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-accounts', () =>
    accounts.map(({ password: _pw, ...rest }) => rest)
  )

  ipcMain.handle('mail:save-account', async (_event, account: MailAccount) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    const idx = accounts.findIndex((a) => a.id === account.id)
    if (idx >= 0) {
      accounts[idx] = account
    } else {
      accounts.push(account)
    }
    saveAccounts(accounts, masterPassphrase)
    imapClients.delete(account.id)
  })

  ipcMain.handle('mail:delete-account', async (_event, accountId: string) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    accounts = accounts.filter((a) => a.id !== accountId)
    saveAccounts(accounts, masterPassphrase)
    imapClients.delete(accountId)
  })

  // ── Folders ───────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-folders', async (_event, accountId: string) => {
    return getClient(accountId).listFolders()
  })

  // ── Messages ──────────────────────────────────────────────────────────────
  ipcMain.handle('mail:list-messages',
    async (_event, accountId: string, folder: string, page: number) => {
      return getClient(accountId).listMessages(folder, page, 50)
    }
  )

  ipcMain.handle('mail:fetch-message',
    async (_event, accountId: string, folder: string, uid: number) => {
      return getClient(accountId).fetchMessage(folder, uid)
    }
  )

  ipcMain.handle('mail:search',
    async (_event, accountId: string, folder: string, criteria: SearchCriteria) => {
      return getClient(accountId).search(folder, criteria)
    }
  )

  ipcMain.handle('mail:mark-read',
    async (_event, accountId: string, folder: string, uid: number, read: boolean) => {
      return getClient(accountId).markRead(folder, uid, read)
    }
  )

  ipcMain.handle('mail:flag',
    async (_event, accountId: string, folder: string, uid: number, flagged: boolean) => {
      return getClient(accountId).flagMessage(folder, uid, flagged)
    }
  )

  ipcMain.handle('mail:delete',
    async (_event, accountId: string, folder: string, uid: number) => {
      return getClient(accountId).deleteMessage(folder, uid)
    }
  )

  ipcMain.handle('mail:move',
    async (_event, accountId: string, folder: string, uid: number, dest: string) => {
      return getClient(accountId).moveMessage(folder, uid, dest)
    }
  )

  // ── Send ──────────────────────────────────────────────────────────────────
  ipcMain.handle('mail:send', async (_event, accountId: string, msg: OutgoingMessage) => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account) throw new Error(`Account ${accountId} not found`)
    await sendMail(account, msg)
  })

  // ── AI ────────────────────────────────────────────────────────────────────
  ipcMain.handle('ai:chat',
    async (_event, history: ChatMessage[], userMessage: string, emailContext?: string) => {
      return chat(history, userMessage, emailContext)
    }
  )
}
