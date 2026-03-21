import { appendFileSync, statSync, renameSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ── Configuration ────────────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), '.caldander')
const LOG_PATH = join(CONFIG_DIR, 'audit.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_ROTATED_FILES = 3

export type AuditLevel = 'info' | 'warn' | 'error'

export interface AuditEntry {
  timestamp: string
  level: AuditLevel
  event: string
  details?: Record<string, unknown>
}

// ── Internal state (overridable for testing) ─────────────────────────────────
let logPath = LOG_PATH
let configDir = CONFIG_DIR
let maxLogSize = MAX_LOG_SIZE
let maxRotatedFiles = MAX_ROTATED_FILES

/**
 * Override log configuration — only intended for testing.
 */
export function _configureForTest(opts: {
  logPath: string
  configDir: string
  maxLogSize?: number
  maxRotatedFiles?: number
}): void {
  logPath = opts.logPath
  configDir = opts.configDir
  if (opts.maxLogSize !== undefined) maxLogSize = opts.maxLogSize
  if (opts.maxRotatedFiles !== undefined) maxRotatedFiles = opts.maxRotatedFiles
}

/**
 * Reset configuration to defaults — only intended for testing.
 */
export function _resetConfig(): void {
  logPath = LOG_PATH
  configDir = CONFIG_DIR
  maxLogSize = MAX_LOG_SIZE
  maxRotatedFiles = MAX_ROTATED_FILES
}

// ── Log rotation ─────────────────────────────────────────────────────────────

function ensureLogDir(): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
  }
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logPath)) return
    const stats = statSync(logPath)
    if (stats.size < maxLogSize) return

    // Shift existing rotated files: audit.log.2 → audit.log.3, etc.
    for (let i = maxRotatedFiles - 1; i >= 1; i--) {
      const from = `${logPath}.${i}`
      const to = `${logPath}.${i + 1}`
      if (existsSync(from)) {
        renameSync(from, to)
      }
    }
    // Current log becomes .1
    renameSync(logPath, `${logPath}.1`)
  } catch {
    // Rotation failure must not break the application
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write a structured audit log entry.
 *
 * Never include sensitive data (passwords, API keys, email bodies) in details.
 */
export function audit(level: AuditLevel, event: string, details?: Record<string, unknown>): void {
  try {
    ensureLogDir()
    rotateIfNeeded()

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...(details && Object.keys(details).length > 0 ? { details } : {})
    }

    appendFileSync(logPath, JSON.stringify(entry) + '\n', { mode: 0o600 })
  } catch {
    // Logging failure must never crash the application
  }
}

/** Convenience helpers */
export const auditInfo = (event: string, details?: Record<string, unknown>): void =>
  audit('info', event, details)

export const auditWarn = (event: string, details?: Record<string, unknown>): void =>
  audit('warn', event, details)

export const auditError = (event: string, details?: Record<string, unknown>): void =>
  audit('error', event, details)
