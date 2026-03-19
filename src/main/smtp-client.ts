import nodemailer from 'nodemailer'
import { MailAccount } from './config'

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
    }
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
  } finally {
    transport.close()
  }
}
