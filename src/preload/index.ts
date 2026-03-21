import { contextBridge, ipcRenderer } from 'electron'
import type { MailAccount, TLSMode } from '../main/config'
import type { SearchCriteria, Folder, MessageSummary, FullMessage } from '../main/imap-client'
import type { OutgoingMessage } from '../main/smtp-client'
import type { ChatMessage } from '../main/ai'

// Re-export types so the renderer can import them from window.api
export type { MailAccount, TLSMode, Folder, MessageSummary, FullMessage, OutgoingMessage, ChatMessage, SearchCriteria }

export type AccountSummary = Omit<MailAccount, 'password'>

export interface UnlockResult {
  ok:     boolean
  error?: string
}

const api = {
  // Auth
  configExists:  ():                                   Promise<boolean>        => ipcRenderer.invoke('mail:config-exists'),
  unlock:        (passphrase: string):                 Promise<UnlockResult>   => ipcRenderer.invoke('mail:unlock', passphrase),
  createConfig:  (passphrase: string):                 Promise<UnlockResult>   => ipcRenderer.invoke('mail:create-config', passphrase),
  onLocked:      (callback: () => void): (() => void) => {
    const handler = (): void => { callback() }
    ipcRenderer.on('app:locked', handler)
    return () => { ipcRenderer.removeListener('app:locked', handler) }
  },

  // Accounts
  listAccounts:  ():                                   Promise<AccountSummary[]> => ipcRenderer.invoke('mail:list-accounts'),
  saveAccount:   (account: MailAccount):               Promise<void>           => ipcRenderer.invoke('mail:save-account', account),
  deleteAccount: (accountId: string):                  Promise<void>           => ipcRenderer.invoke('mail:delete-account', accountId),

  // Folders
  listFolders:   (accountId: string):                  Promise<Folder[]>       => ipcRenderer.invoke('mail:list-folders', accountId),

  // Messages
  listMessages:  (accountId: string, folder: string, page: number) => ipcRenderer.invoke('mail:list-messages', accountId, folder, page) as Promise<MessageSummary[]>,
  fetchMessage:  (accountId: string, folder: string, uid: number) => ipcRenderer.invoke('mail:fetch-message', accountId, folder, uid) as Promise<FullMessage>,
  search:        (accountId: string, folder: string, criteria: SearchCriteria) => ipcRenderer.invoke('mail:search', accountId, folder, criteria) as Promise<MessageSummary[]>,
  markRead:      (accountId: string, folder: string, uid: number, read: boolean) => ipcRenderer.invoke('mail:mark-read', accountId, folder, uid, read) as Promise<void>,
  flagMessage:   (accountId: string, folder: string, uid: number, flagged: boolean) => ipcRenderer.invoke('mail:flag', accountId, folder, uid, flagged) as Promise<void>,
  deleteMessage: (accountId: string, folder: string, uid: number) => ipcRenderer.invoke('mail:delete', accountId, folder, uid) as Promise<void>,
  moveMessage:   (accountId: string, folder: string, uid: number, dest: string) => ipcRenderer.invoke('mail:move', accountId, folder, uid, dest) as Promise<void>,

  // Attachments
  downloadAttachment: (accountId: string, folder: string, uid: number, attachmentIndex: number) =>
    ipcRenderer.invoke('mail:download-attachment', accountId, folder, uid, attachmentIndex) as Promise<{ saved: boolean; filePath?: string }>,

  // Send
  sendMail:      (accountId: string, msg: OutgoingMessage) => ipcRenderer.invoke('mail:send', accountId, msg) as Promise<void>,

  // AI
  aiGetApiKey:   ():                                   Promise<string | null>  => ipcRenderer.invoke('ai:get-api-key'),
  aiSaveApiKey:  (key: string):                        Promise<void>           => ipcRenderer.invoke('ai:save-api-key', key),
  aiChat:        (history: ChatMessage[], userMessage: string, emailContext?: string) => ipcRenderer.invoke('ai:chat', history, userMessage, emailContext) as Promise<string>
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
