/**
 * Input validation for IPC parameters at the renderer → main process boundary.
 *
 * All values arriving over IPC are untrusted at runtime (TypeScript types are
 * compile-time only). These helpers enforce type, format and range constraints
 * before values reach IMAP / SMTP operations.
 */

import type { SearchCriteria } from './imap-client'

// ── Dangerous characters ────────────────────────────────────────────────────
// CR, LF and NUL can be used for IMAP protocol injection.
const IMAP_INJECTION_RE = /[\r\n\x00]/

// ── Account ID ──────────────────────────────────────────────────────────────
/** Account IDs are typically UUIDs — allow alphanumeric plus hyphens. */
export function validateAccountId(id: unknown): string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Invalid account ID: must be a non-empty string')
  }
  if (!/^[a-z0-9-]+$/i.test(id)) {
    throw new Error('Invalid account ID: contains disallowed characters')
  }
  if (id.length > 64) {
    throw new Error('Invalid account ID: exceeds maximum length')
  }
  return id
}

// ── Folder name ─────────────────────────────────────────────────────────────
export function validateFolder(folder: unknown): string {
  if (typeof folder !== 'string' || folder.length === 0) {
    throw new Error('Invalid folder name: must be a non-empty string')
  }
  if (folder.length > 256) {
    throw new Error('Invalid folder name: exceeds maximum length')
  }
  if (IMAP_INJECTION_RE.test(folder)) {
    throw new Error('Invalid folder name: contains control characters')
  }
  return folder
}

// ── UID ─────────────────────────────────────────────────────────────────────
export function validateUid(uid: unknown): number {
  if (typeof uid !== 'number' || !Number.isInteger(uid) || uid < 1) {
    throw new Error('Invalid UID: must be a positive integer')
  }
  if (uid > 0xFFFFFFFF) {
    throw new Error('Invalid UID: exceeds IMAP UID range')
  }
  return uid
}

// ── Page number ─────────────────────────────────────────────────────────────
export function validatePage(page: unknown): number {
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 0) {
    throw new Error('Invalid page: must be a non-negative integer')
  }
  return page
}

// ── Boolean flag ────────────────────────────────────────────────────────────
export function validateBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${name}: must be a boolean`)
  }
  return value
}

// ── Search criteria ─────────────────────────────────────────────────────────
export function validateSearchCriteria(criteria: unknown): SearchCriteria {
  if (criteria === null || typeof criteria !== 'object') {
    throw new Error('Invalid search criteria: must be an object')
  }

  const c = criteria as Record<string, unknown>
  const result: SearchCriteria = {}

  if (c.seen !== undefined) {
    if (typeof c.seen !== 'boolean') {
      throw new Error('Invalid search criteria: seen must be a boolean')
    }
    result.seen = c.seen
  }

  if (c.flagged !== undefined) {
    if (typeof c.flagged !== 'boolean') {
      throw new Error('Invalid search criteria: flagged must be a boolean')
    }
    result.flagged = c.flagged
  }

  if (c.from !== undefined) {
    if (typeof c.from !== 'string') {
      throw new Error('Invalid search criteria: from must be a string')
    }
    if (IMAP_INJECTION_RE.test(c.from)) {
      throw new Error('Invalid search criteria: from contains control characters')
    }
    if (c.from.length > 256) {
      throw new Error('Invalid search criteria: from exceeds maximum length')
    }
    result.from = c.from
  }

  if (c.subject !== undefined) {
    if (typeof c.subject !== 'string') {
      throw new Error('Invalid search criteria: subject must be a string')
    }
    if (IMAP_INJECTION_RE.test(c.subject)) {
      throw new Error('Invalid search criteria: subject contains control characters')
    }
    if (c.subject.length > 256) {
      throw new Error('Invalid search criteria: subject exceeds maximum length')
    }
    result.subject = c.subject
  }

  if (c.since !== undefined) {
    const d = new Date(c.since as string | number)
    if (isNaN(d.getTime())) {
      throw new Error('Invalid search criteria: since must be a valid date')
    }
    result.since = d
  }

  if (c.before !== undefined) {
    const d = new Date(c.before as string | number)
    if (isNaN(d.getTime())) {
      throw new Error('Invalid search criteria: before must be a valid date')
    }
    result.before = d
  }

  return result
}

// ── Attachment index ────────────────────────────────────────────────────────
export function validateAttachmentIndex(index: unknown): number {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw new Error('Invalid attachment index: must be a non-negative integer')
  }
  if (index > 1000) {
    throw new Error('Invalid attachment index: exceeds maximum value')
  }
  return index
}

// ── String field (general purpose) ──────────────────────────────────────────
export function validateString(value: unknown, name: string, maxLength = 1024): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${name}: must be a string`)
  }
  if (value.length > maxLength) {
    throw new Error(`Invalid ${name}: exceeds maximum length`)
  }
  return value
}
