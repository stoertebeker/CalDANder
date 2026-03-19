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

  // Accounts
  listAccounts:  ():                                   Promise<AccountSummary[]> => ipcRenderer.invoke('mail:list-accounts'),
  saveAccount:   (account: MailAccount):               Promise<void>           => ipcRenderer.invoke('mail:save-account', account),
  deleteAccount: (accountId: string):                  Promise<void>           => ipcRenderer.invoke('mail:delete-account', accountId),

  // Folders
  listFolders:   (accountId: string):                  Promise<Folder[]>       => ipcRenderer.invoke('mail:list-folders', accountId),

  // Messages
  listMessages:  (accountId: string, folder: string, page: number): Promise<MessageSummary[]>
                                                                                => ipcRenderer.invoke('mail:list-messages', accountId, folder, page),
  fetchMessage:  (accountId: string, folder: string, uid: number):  Promise<FullMessage>
                                                                                => ipcRenderer.invoke('mail:fetch-message', accountId, folder, uid),
  search:        (accountId: string, folder: string, criteria: SearchCriteria): Promise<MessageSummary[]>
                                                                                => ipcRenderer.invoke('mail:search', accountId, folder, criteria),
  markRead:      (accountId: string, folder: string, uid: number, read: boolean): Promise<void>
                                                                                => ipcRenderer.invoke('mail:mark-read', accountId, folder, uid, read),
  flagMessage:   (accountId: string, folder: string, uid: number, flagged: boolean): Promise<void>
                                                                                => ipcRenderer.invoke('mail:flag', accountId, folder, uid, flagged),
  deleteMessage: (accountId: string, folder: string, uid: number):  Promise<void>
                                                                                => ipcRenderer.invoke('mail:delete', accountId, folder, uid),
  moveMessage:   (accountId: string, folder: string, uid: number, dest: string): Promise<void>
                                                                                => ipcRenderer.invoke('mail:move', accountId, folder, uid, dest),

  // Send
  sendMail:      (accountId: string, msg: OutgoingMessage):         Promise<void>
                                                                                => ipcRenderer.invoke('mail:send', accountId, msg),

  // AI
  aiChat:        (history: ChatMessage[], userMessage: string, emailContext?: string): Promise<string>
                                                                                => ipcRenderer.invoke('ai:chat', history, userMessage, emailContext)
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
