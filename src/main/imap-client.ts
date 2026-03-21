import { ImapFlow, MailboxLockObject, FetchMessageObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import { MailAccount } from './config'
import { auditInfo, auditError } from './audit-logger'
import { toUserError } from './mail-errors'

export interface Folder {
  path: string
  name: string
  delimiter: string
  flags: Set<string>
  specialUse?: string
}

export interface MessageSummary {
  uid: number
  subject: string
  from: string
  date: string
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
}

export interface FullMessage {
  uid: number
  subject: string
  from: string
  to: string
  cc: string
  date: string
  textBody: string
  htmlBody: string
  attachments: { filename: string; size: number; contentType: string }[]
  messageId: string
  references: string
  inReplyTo: string
}

export interface SearchCriteria {
  seen?: boolean
  flagged?: boolean
  from?: string
  subject?: string
  since?: Date
  before?: Date
}

function buildClient(account: MailAccount): ImapFlow {
  const secure = account.imapTLS === 'implicit'

  return new ImapFlow({
    host:   account.imapHost,
    port:   account.imapPort,
    secure,
    auth: {
      user: account.username,
      pass: account.password
    },
    tls: {
      rejectUnauthorized: true   // strict cert verification — never disabled
    },
    logger: false,
    connectionTimeout: 10_000,   // 10 s to establish TCP connection
    greetingTimeout:    5_000,   // 5 s for server greeting after connect
    socketTimeout:     30_000    // 30 s for socket inactivity
  })
}

export class IMAPClient {
  private account: MailAccount

  constructor(account: MailAccount) {
    this.account = account
  }

  /** Connect with audit logging for success/failure. */
  private async connect(client: ImapFlow): Promise<void> {
    try {
      await client.connect()
      auditInfo('imap.connected', { host: this.account.imapHost, port: this.account.imapPort })
    } catch (err) {
      auditError('imap.connection-failed', {
        host: this.account.imapHost,
        port: this.account.imapPort,
        reason: (err as Error).message
      })
      throw toUserError(err, 'imap.connect')
    }
  }

  /**
   * Run an IMAP operation with automatic error translation.
   * Any error thrown inside `fn` is translated to a user-friendly message.
   */
  private async withClient<T>(
    label: string,
    fn: (client: ImapFlow) => Promise<T>
  ): Promise<T> {
    const client = buildClient(this.account)
    try {
      await this.connect(client)
      return await fn(client)
    } catch (err) {
      // connect() already translates its own errors; re-translate only if
      // the error didn't originate from connect (i.e. post-connect failures)
      throw toUserError(err, `imap.${label}`)
    } finally {
      try { await client.logout() } catch { /* best effort */ }
    }
  }

  async listFolders(): Promise<Folder[]> {
    return this.withClient('listFolders', async (client) => {
      const list = await client.list()
      return list.map((m) => ({
        path:       m.path,
        name:       m.name,
        delimiter:  m.delimiter ?? '/',
        flags:      m.flags,
        specialUse: m.specialUse
      }))
    })
  }

  async listMessages(
    folder: string,
    page: number,
    pageSize: number
  ): Promise<MessageSummary[]> {
    return this.withClient('listMessages', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        const status = await client.status(folder, { messages: true })
        const total  = status.messages ?? 0
        if (total === 0) return []

        const start = Math.max(1, total - (page + 1) * pageSize + 1)
        const end   = Math.max(1, total - page * pageSize)
        const range  = `${start}:${end}`

        const results: MessageSummary[] = []
        for await (const msg of client.fetch(range, {
          uid:      true,
          flags:    true,
          envelope: true,
          bodyStructure: true
        })) {
          results.push(summarise(msg))
        }
        return results.reverse()
      } finally {
        lock?.release()
      }
    })
  }

  async fetchMessage(folder: string, uid: number): Promise<FullMessage> {
    return this.withClient('fetchMessage', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        const msg = await client.fetchOne(`${uid}`, {
          uid:           true,
          flags:         true,
          envelope:      true,
          bodyStructure: true,
          source:        true
        }, { uid: true })

        if (!msg) throw new Error(`Nachricht nicht gefunden.`)

        const parsed = await parseSource(msg.source ?? Buffer.alloc(0))
        return {
          uid:         msg.uid,
          subject:     msg.envelope?.subject ?? '(no subject)',
          from:        formatAddress(msg.envelope?.from),
          to:          formatAddress(msg.envelope?.to),
          cc:          formatAddress(msg.envelope?.cc),
          date:        msg.envelope?.date?.toISOString() ?? '',
          textBody:    parsed.text,
          htmlBody:    parsed.html,
          attachments: parsed.attachments,
          messageId:   msg.envelope?.messageId ?? '',
          references:  (msg.envelope as unknown as { references?: string })?.references ?? '',
          inReplyTo:   (msg.envelope as unknown as { inReplyTo?: string })?.inReplyTo ?? ''
        }
      } finally {
        lock?.release()
      }
    })
  }

  async downloadAttachment(
    folder: string,
    uid: number,
    attachmentIndex: number
  ): Promise<AttachmentData> {
    return this.withClient('downloadAttachment', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        const msg = await client.fetchOne(`${uid}`, {
          uid:    true,
          source: true
        }, { uid: true })

        if (!msg) throw new Error('Nachricht nicht gefunden.')

        return extractAttachment(msg.source ?? Buffer.alloc(0), attachmentIndex)
      } finally {
        lock?.release()
      }
    })
  }

  async search(folder: string, criteria: SearchCriteria): Promise<MessageSummary[]> {
    return this.withClient('search', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        const query: Record<string, unknown> = {}
        if (criteria.seen !== undefined)    query['seen']    = criteria.seen
        if (criteria.flagged !== undefined) query['flagged'] = criteria.flagged
        if (criteria.from)    query['from']    = criteria.from
        if (criteria.subject) query['subject'] = criteria.subject
        if (criteria.since)   query['since']   = criteria.since
        if (criteria.before)  query['before']  = criteria.before

        const uids = await client.search(query, { uid: true })
        if (uids.length === 0) return []

        const range = uids.slice(0, 200).join(',')
        const results: MessageSummary[] = []
        for await (const msg of client.fetch(range, {
          uid: true, flags: true, envelope: true, bodyStructure: true
        }, { uid: true })) {
          results.push(summarise(msg))
        }
        return results.reverse()
      } finally {
        lock?.release()
      }
    })
  }

  async markRead(folder: string, uid: number, read: boolean): Promise<void> {
    await this.flagOp(folder, uid, '\\Seen', read)
  }

  async flagMessage(folder: string, uid: number, flagged: boolean): Promise<void> {
    await this.flagOp(folder, uid, '\\Flagged', flagged)
  }

  async deleteMessage(folder: string, uid: number): Promise<void> {
    return this.withClient('deleteMessage', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        await client.messageDelete(`${uid}`, { uid: true })
      } finally {
        lock?.release()
      }
    })
  }

  async moveMessage(folder: string, uid: number, dest: string): Promise<void> {
    return this.withClient('moveMessage', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        await client.messageMove(`${uid}`, dest, { uid: true })
      } finally {
        lock?.release()
      }
    })
  }

  private async flagOp(folder: string, uid: number, flag: string, add: boolean): Promise<void> {
    return this.withClient('flagOp', async (client) => {
      let lock: MailboxLockObject | null = null
      try {
        lock = await client.getMailboxLock(folder)
        if (add) {
          await client.messageFlagsAdd(`${uid}`, [flag], { uid: true })
        } else {
          await client.messageFlagsRemove(`${uid}`, [flag], { uid: true })
        }
      } finally {
        lock?.release()
      }
    })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summarise(msg: FetchMessageObject): MessageSummary {
  const hasAttachments = hasAttachmentParts(msg.bodyStructure)
  return {
    uid:            msg.uid,
    subject:        msg.envelope?.subject ?? '(no subject)',
    from:           formatAddress(msg.envelope?.from),
    date:           msg.envelope?.date?.toISOString() ?? '',
    seen:           msg.flags?.has('\\Seen') ?? false,
    flagged:        msg.flags?.has('\\Flagged') ?? false,
    hasAttachments
  }
}

function hasAttachmentParts(struct: unknown): boolean {
  if (!struct || typeof struct !== 'object') return false
  const s = struct as Record<string, unknown>
  if (s['disposition'] === 'attachment') return true
  if (Array.isArray(s['childNodes'])) {
    return (s['childNodes'] as unknown[]).some(hasAttachmentParts)
  }
  return false
}

function formatAddress(
  addrs?: Array<{ name?: string; address?: string }> | null
): string {
  if (!addrs || addrs.length === 0) return ''
  return addrs.map((a) => (a.name ? `${a.name} <${a.address ?? ''}>` : (a.address ?? ''))).join(', ')
}

export interface AttachmentData {
  filename: string
  contentType: string
  content: Buffer
}

async function parseSource(
  source: Buffer
): Promise<{ text: string; html: string; attachments: FullMessage['attachments'] }> {
  const parsed = await simpleParser(source)
  const attachments = (parsed.attachments ?? [])
    .filter((a) => a.contentDisposition === 'attachment')
    .map((a) => ({
      filename:    a.filename ?? 'attachment',
      size:        a.size ?? 0,
      contentType: a.contentType
    }))
  return {
    text:        parsed.text  ?? '',
    html:        parsed.html  ?? '',
    attachments
  }
}

async function extractAttachment(
  source: Buffer,
  attachmentIndex: number
): Promise<AttachmentData> {
  const parsed = await simpleParser(source)
  const attachments = (parsed.attachments ?? [])
    .filter((a) => a.contentDisposition === 'attachment')

  if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
    throw new Error('Anhang nicht gefunden.')
  }

  const att = attachments[attachmentIndex]
  return {
    filename:    att.filename ?? 'attachment',
    contentType: att.contentType,
    content:     att.content
  }
}
