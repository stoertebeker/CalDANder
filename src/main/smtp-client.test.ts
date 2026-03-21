import { describe, it, expect, vi } from 'vitest'

// Capture the config passed to nodemailer.createTransport
let capturedConfig: Record<string, unknown> | null = null

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport(config: Record<string, unknown>) {
        capturedConfig = config
        return {
          sendMail: vi.fn().mockResolvedValue({}),
          close: vi.fn()
        }
      }
    }
  }
})

import { sendMail } from './smtp-client'
import type { MailAccount } from './config'

const fakeAccount: MailAccount = {
  id: 'test',
  displayName: 'Test',
  emailAddress: 'test@example.com',
  username: 'test',
  password: 'pass',
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapTLS: 'implicit',
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpTLS: 'implicit'
}

const fakeMessage = {
  to: ['recipient@example.com'],
  subject: 'Test',
  textBody: 'Hello'
}

describe('SMTP client timeout configuration', () => {
  it('sets connectionTimeout to 10 000 ms', async () => {
    await sendMail(fakeAccount, fakeMessage)
    expect(capturedConfig).not.toBeNull()
    expect(capturedConfig!.connectionTimeout).toBe(10_000)
  })

  it('sets greetingTimeout to 5 000 ms', async () => {
    await sendMail(fakeAccount, fakeMessage)
    expect(capturedConfig!.greetingTimeout).toBe(5_000)
  })

  it('sets socketTimeout to 30 000 ms', async () => {
    await sendMail(fakeAccount, fakeMessage)
    expect(capturedConfig!.socketTimeout).toBe(30_000)
  })
})
