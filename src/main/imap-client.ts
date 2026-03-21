import { ImapFlow, MailboxLockObject, FetchMessageObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import { MailAccount } from './config'
import { auditInfo, auditError } from './audit-logger'

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
      throw err
    }
  }

  async listFolders(): Promise<Folder[]> {
    const client = buildClient(this.account)
    await this.connect(client)
    try {
      const list = await client.list()
      return list.map((m) => ({
        path:       m.path,
        name:       m.name,
        delimiter:  m.delimiter ?? '/',
        flags:      m.flags,
        specialUse: m.specialUse
      }))
    } finally {
      await client.logout()
    }
  }

  async listMessages(
    folder: string,
    page: number,
    pageSize: number
  ): Promise<MessageSummary[]> {
    const client = buildClient(this.account)
    await this.connect(client)
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
      await client.logout()
    }
  }

  async fetchMessage(folder: string, uid: number): Promise<FullMessage> {
    const client = buildClient(this.account)
    await this.connect(client)
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

      if (!msg) throw new Error(`Message UID ${uid} not found in ${folder}`)

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
      await client.logout()
    }
  }

  async search(folder: string, criteria: SearchCriteria): Promise<MessageSummary[]> {
    const client = buildClient(this.account)
    await this.connect(client)
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
      await client.logout()
    }
  }

  async markRead(folder: string, uid: number, read: boolean): Promise<void> {
    await this.flagOp(folder, uid, '\\Seen', read)
  }

  async flagMessage(folder: string, uid: number, flagged: boolean): Promise<void> {
    await this.flagOp(folder, uid, '\\Flagged', flagged)
  }

  async deleteMessage(folder: string, uid: number): Promise<void> {
    const client = buildClient(this.account)
    await this.connect(client)
    let lock: MailboxLockObject | null = null
    try {
      lock = await client.getMailboxLock(folder)
      await client.messageDelete(`${uid}`, { uid: true })
    } finally {
      lock?.release()
      await client.logout()
    }
  }

  async moveMessage(folder: string, uid: number, dest: string): Promise<void> {
    const client = buildClient(this.account)
    await this.connect(client)
    let lock: MailboxLockObject | null = null
    try {
      lock = await client.getMailboxLock(folder)
      await client.messageMove(`${uid}`, dest, { uid: true })
    } finally {
      lock?.release()
      await client.logout()
    }
  }

  private async flagOp(folder: string, uid: number, flag: string, add: boolean): Promise<void> {
    const client = buildClient(this.account)
    await this.connect(client)
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
      await client.logout()
    }
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
