import { describe, it, expect, vi } from 'vitest'

// Capture the config passed to ImapFlow constructor
let capturedConfig: Record<string, unknown> | null = null

vi.mock('imapflow', () => {
  return {
    ImapFlow: class MockImapFlow {
      constructor(config: Record<string, unknown>) {
        capturedConfig = config
      }
      async connect() { /* noop */ }
      async logout() { /* noop */ }
      async list() { return [] }
    }
  }
})

vi.mock('mailparser', () => ({ simpleParser: vi.fn() }))

import { IMAPClient } from './imap-client'
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

describe('IMAP client timeout configuration', () => {
  it('sets connectionTimeout to 10 000 ms', async () => {
    const client = new IMAPClient(fakeAccount)
    await client.listFolders()
    expect(capturedConfig).not.toBeNull()
    expect(capturedConfig!.connectionTimeout).toBe(10_000)
  })

  it('sets greetingTimeout to 5 000 ms', async () => {
    const client = new IMAPClient(fakeAccount)
    await client.listFolders()
    expect(capturedConfig!.greetingTimeout).toBe(5_000)
  })

  it('sets socketTimeout to 30 000 ms', async () => {
    const client = new IMAPClient(fakeAccount)
    await client.listFolders()
    expect(capturedConfig!.socketTimeout).toBe(30_000)
  })
})
