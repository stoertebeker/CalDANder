import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFile, stat } from 'node:fs/promises'
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
  validateString,
  validateAttachmentIndex
} from './ipc-validators'
import { auditInfo, auditWarn, auditError } from './audit-logger'

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
  auditInfo('app.locked')
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
  if (!account) throw new Error('Konto nicht gefunden.')
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
      auditInfo('auth.unlock', { success: true })
      return { ok: true }
    } catch (err) {
      auditWarn('auth.unlock', { success: false, reason: (err as Error).message })
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
      auditInfo('auth.config-created')
      return { ok: true }
    } catch (err) {
      auditError('auth.config-created', { success: false, reason: (err as Error).message })
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
    const action = idx >= 0 ? 'updated' : 'added'
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
    auditInfo(`account.${action}`, { accountId: account.id, email: account.emailAddress })
  })

  ipcMain.handle('mail:delete-account', async (_event, accountId: string) => {
    if (!masterPassphrase) throw new Error('Not unlocked')
    resetLockTimer()
    const validId = validateAccountId(accountId)
    accounts = accounts.filter((a) => a.id !== validId)
    saveAccounts(accounts, masterPassphrase)
    imapClients.delete(validId)
    auditInfo('account.deleted', { accountId: validId })
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

  ipcMain.handle('mail:download-attachment',
    async (_event, accountId: string, folder: string, uid: number, attachmentIndex: number) => {
      resetLockTimer()
      const validId    = validateAccountId(accountId)
      const validFolder = validateFolder(folder)
      const validUid   = validateUid(uid)
      const validIndex = validateAttachmentIndex(attachmentIndex)

      const attachment = await getClient(validId)
        .downloadAttachment(validFolder, validUid, validIndex)

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: attachment.filename,
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })

      if (canceled || !filePath) return { saved: false }

      await writeFile(filePath, attachment.content)
      auditInfo('mail.attachment-downloaded', {
        accountId: validId, folder: validFolder, uid: validUid, attachmentIndex: validIndex
      })
      return { saved: true, filePath }
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
      const validId = validateAccountId(accountId)
      const validUid = validateUid(uid)
      await getClient(validId).deleteMessage(validateFolder(folder), validUid)
      auditInfo('mail.deleted', { accountId: validId, folder, uid: validUid })
    }
  )

  ipcMain.handle('mail:move',
    async (_event, accountId: string, folder: string, uid: number, dest: string) => {
      resetLockTimer()
      const validId = validateAccountId(accountId)
      const validUid = validateUid(uid)
      const validDest = validateFolder(dest)
      await getClient(validId).moveMessage(validateFolder(folder), validUid, validDest)
      auditInfo('mail.moved', { accountId: validId, folder, uid: validUid, destination: validDest })
    }
  )

  // ── File dialog ───────────────────────────────────────────────────────────
  ipcMain.handle('file:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })

    if (result.canceled) {
      return { canceled: true }
    }

    // Validate file sizes on main thread
    const fileSizes: number[] = []
    for (const filePath of result.filePaths) {
      try {
        const stats = await stat(filePath)
        fileSizes.push(stats.size)
      } catch (err) {
        auditError('file.open-dialog', {
          reason: `Failed to stat file: ${(err as Error).message}`,
          filePath
        })
        throw new Error(`Fehler beim Lesen der Dateigröße: ${(err as Error).message}`)
      }
    }

    auditInfo('file.open-dialog', { fileCount: result.filePaths.length })
    return { canceled: false, filePaths: result.filePaths, fileSizes }
  })

  // ── Send ──────────────────────────────────────────────────────────────────
  ipcMain.handle('mail:send', async (_event, accountId: string, msg: OutgoingMessage) => {
    resetLockTimer()
    const validId = validateAccountId(accountId)
    const account = accounts.find((a) => a.id === validId)
    if (!account) throw new Error('Konto nicht gefunden.')
    // sendMail already translates errors to user-friendly messages
    await sendMail(account, msg)
    auditInfo('mail.sent', { accountId: validId, recipientCount: msg.to.length })
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
    auditInfo('config.api-key-saved')
  })

  ipcMain.handle('ai:chat',
    async (_event, history: ChatMessage[], userMessage: string, emailContext?: string) => {
      if (!masterPassphrase) throw new Error('Not unlocked')
      resetLockTimer()
      const storedKey = loadApiKey(masterPassphrase) ?? undefined
      try {
        const result = await chat(history, userMessage, emailContext, storedKey)
        auditInfo('ai.chat', { hasEmailContext: !!emailContext })
        return result
      } catch (err) {
        auditError('ai.chat', { success: false, reason: (err as Error).message })
        throw err
      }
    }
  )
}
