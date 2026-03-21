import nodemailer from 'nodemailer'
import { MailAccount } from './config'
import { auditInfo, auditError } from './audit-logger'

export interface OutgoingMessage {
  to:          string[]
  cc?:         string[]
  bcc?:        string[]
  subject:     string
  textBody:    string
  htmlBody?:   string
  attachments?: { path: string }[]
  inReplyTo?:  string
  references?: string
}

export async function sendMail(account: MailAccount, msg: OutgoingMessage): Promise<void> {
  const implicit = account.smtpTLS === 'implicit'

  const transport = nodemailer.createTransport({
    host:        account.smtpHost,
    port:        account.smtpPort,
    secure:      implicit,          // true = Implicit TLS (465), false = STARTTLS (587)
    requireTLS:  !implicit,         // force STARTTLS before auth — refuses plaintext fallback
    auth: {
      user: account.username,
      pass: account.password
    },
    tls: {
      rejectUnauthorized: true      // strict certificate verification — never disabled
    },
    connectionTimeout: 10_000,      // 10 s to establish TCP connection
    greetingTimeout:    5_000,      // 5 s for server greeting after connect
    socketTimeout:     30_000       // 30 s for socket inactivity
  })

  try {
    await transport.sendMail({
      from:        `${account.displayName} <${account.emailAddress}>`,
      to:          msg.to.join(', '),
      cc:          msg.cc?.join(', '),
      bcc:         msg.bcc?.join(', '),
      subject:     msg.subject,
      text:        msg.textBody,
      html:        msg.htmlBody,
      attachments: msg.attachments,
      inReplyTo:   msg.inReplyTo,
      references:  msg.references
    })
    auditInfo('smtp.sent', { host: account.smtpHost, port: account.smtpPort, recipientCount: msg.to.length })
  } catch (err) {
    auditError('smtp.send-failed', { host: account.smtpHost, port: account.smtpPort, reason: (err as Error).message })
    throw err
  } finally {
    transport.close()
  }
}
