import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock imapflow before importing the module under test
const mockFetchOne = vi.fn()
const mockGetMailboxLock = vi.fn()
const mockRelease = vi.fn()

vi.mock('imapflow', () => {
  return {
    ImapFlow: class MockImapFlow {
      async connect() { /* noop */ }
      async logout() { /* noop */ }
      getMailboxLock = mockGetMailboxLock
      fetchOne = mockFetchOne
    }
  }
})

vi.mock('mailparser', async () => {
  const { simpleParser: realParser } = await vi.importActual<typeof import('mailparser')>('mailparser')
  return { simpleParser: realParser }
})

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

// Build a minimal RFC 822 message with an attachment
function buildMessageWithAttachment(): Buffer {
  const boundary = '----=_Part_123'
  const raw = [
    'From: sender@example.com',
    'To: recipient@example.com',
    'Subject: Test with attachment',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    'MIME-Version: 1.0',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    '',
    'Hello, this is the body.',
    '',
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    'Content-Disposition: attachment; filename="test-file.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('Hello attachment content!').toString('base64'),
    '',
    `--${boundary}--`
  ].join('\r\n')
  return Buffer.from(raw)
}

function buildMessageWithMultipleAttachments(): Buffer {
  const boundary = '----=_Part_456'
  const raw = [
    'From: sender@example.com',
    'To: recipient@example.com',
    'Subject: Test with multiple attachments',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    'MIME-Version: 1.0',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    '',
    'Body text.',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Disposition: attachment; filename="first.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('First file').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename="second.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('Second file').toString('base64'),
    '',
    `--${boundary}--`
  ].join('\r\n')
  return Buffer.from(raw)
}

describe('IMAPClient.downloadAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMailboxLock.mockResolvedValue({ release: mockRelease })
  })

  it('downloads a single attachment by index', async () => {
    const source = buildMessageWithAttachment()
    mockFetchOne.mockResolvedValue({ uid: 1, source })

    const client = new IMAPClient(fakeAccount)
    const result = await client.downloadAttachment('INBOX', 1, 0)

    expect(result.filename).toBe('test-file.txt')
    expect(result.content.toString()).toBe('Hello attachment content!')
    expect(mockRelease).toHaveBeenCalled()
  })

  it('downloads the correct attachment when multiple exist', async () => {
    const source = buildMessageWithMultipleAttachments()
    mockFetchOne.mockResolvedValue({ uid: 2, source })

    const client = new IMAPClient(fakeAccount)

    const first = await client.downloadAttachment('INBOX', 2, 0)
    expect(first.filename).toBe('first.txt')
    expect(first.content.toString()).toBe('First file')

    const second = await client.downloadAttachment('INBOX', 2, 1)
    expect(second.filename).toBe('second.pdf')
    expect(second.contentType).toBe('application/pdf')
    expect(second.content.toString()).toBe('Second file')
  })

  it('throws when attachment index is out of range', async () => {
    const source = buildMessageWithAttachment()
    mockFetchOne.mockResolvedValue({ uid: 1, source })

    const client = new IMAPClient(fakeAccount)
    await expect(client.downloadAttachment('INBOX', 1, 5)).rejects.toThrow()
  })

  it('throws when message is not found', async () => {
    mockFetchOne.mockResolvedValue(null)

    const client = new IMAPClient(fakeAccount)
    await expect(client.downloadAttachment('INBOX', 999, 0)).rejects.toThrow()
  })

  it('releases the mailbox lock even on error', async () => {
    mockFetchOne.mockRejectedValue(new Error('network error'))

    const client = new IMAPClient(fakeAccount)
    await expect(client.downloadAttachment('INBOX', 1, 0)).rejects.toThrow()
    expect(mockRelease).toHaveBeenCalled()
  })
})
