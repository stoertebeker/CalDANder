import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron before importing the module under test
vi.mock('electron', () => {
  const mockSend = vi.fn()
  const mockGetAllWindows = vi.fn(() => [
    { webContents: { send: mockSend } }
  ])
  return {
    ipcMain: {
      handle: vi.fn()
    },
    BrowserWindow: {
      getAllWindows: mockGetAllWindows,
      // expose the inner mocks for test assertions
      __mockSend: mockSend,
      __mockGetAllWindows: mockGetAllWindows
    }
  }
})

vi.mock('./config', () => ({
  loadAccounts: vi.fn(() => []),
  saveAccounts: vi.fn(),
  configExists: vi.fn(),
  loadApiKey: vi.fn(),
  saveApiKey: vi.fn()
}))

vi.mock('./imap-client', () => ({
  IMAPClient: vi.fn()
}))

vi.mock('./smtp-client', () => ({
  sendMail: vi.fn()
}))

vi.mock('./ai', () => ({
  chat: vi.fn()
}))

import { lockApp, registerIpcHandlers } from './ipc-handlers'
import { ipcMain, BrowserWindow } from 'electron'

// Retrieve mock functions exposed via BrowserWindow
const mockSend = (BrowserWindow as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend
const mockGetAllWindows = (BrowserWindow as unknown as { __mockGetAllWindows: ReturnType<typeof vi.fn> }).__mockGetAllWindows

describe('auto-lock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    // Reset default return value after clearAllMocks
    mockGetAllWindows.mockReturnValue([{ webContents: { send: mockSend } }])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lockApp sends app:locked to all windows', () => {
    lockApp()
    expect(mockSend).toHaveBeenCalledWith('app:locked')
  })

  it('lockApp handles case with no open windows', () => {
    mockGetAllWindows.mockReturnValueOnce([])
    expect(() => lockApp()).not.toThrow()
  })

  it('lockApp sends to multiple windows', () => {
    const mockSend2 = vi.fn()
    mockGetAllWindows.mockReturnValueOnce([
      { webContents: { send: mockSend } },
      { webContents: { send: mockSend2 } }
    ])
    lockApp()
    expect(mockSend).toHaveBeenCalledWith('app:locked')
    expect(mockSend2).toHaveBeenCalledWith('app:locked')
  })

  describe('inactivity timer', () => {
    let handlers: Map<string, (...args: unknown[]) => unknown>

    beforeEach(() => {
      handlers = new Map()
      vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
        return undefined as never
      })
      registerIpcHandlers()
    })

    it('unlock starts the inactivity timer that fires after 5 minutes', async () => {
      const unlock = handlers.get('mail:unlock')!
      const { loadAccounts } = await import('./config')
      vi.mocked(loadAccounts).mockReturnValue([])

      await unlock({} as never, 'mypassphrase')

      // Timer should not fire before 5 minutes
      vi.advanceTimersByTime(4 * 60 * 1000)
      expect(mockSend).not.toHaveBeenCalled()

      // Timer fires at 5 minutes
      vi.advanceTimersByTime(1 * 60 * 1000)
      expect(mockSend).toHaveBeenCalledWith('app:locked')
    })

    it('create-config starts the inactivity timer', async () => {
      const createConfig = handlers.get('mail:create-config')!

      await createConfig({} as never, 'mypassphrase')

      vi.advanceTimersByTime(5 * 60 * 1000)
      expect(mockSend).toHaveBeenCalledWith('app:locked')
    })

    it('activity resets the timer so it does not fire prematurely', async () => {
      // First unlock
      const unlock = handlers.get('mail:unlock')!
      const { loadAccounts } = await import('./config')
      vi.mocked(loadAccounts).mockReturnValue([])
      await unlock({} as never, 'mypassphrase')

      // Simulate activity at 3 minutes (list-accounts resets timer)
      vi.advanceTimersByTime(3 * 60 * 1000)
      const listAccounts = handlers.get('mail:list-accounts')!
      listAccounts({} as never)

      // After another 3 minutes (6 min total), timer should NOT have fired
      // because it was reset at the 3 min mark
      vi.advanceTimersByTime(3 * 60 * 1000)
      expect(mockSend).not.toHaveBeenCalled()

      // After another 2 minutes (5 min since last activity), timer fires
      vi.advanceTimersByTime(2 * 60 * 1000)
      expect(mockSend).toHaveBeenCalledWith('app:locked')
    })
  })
})
