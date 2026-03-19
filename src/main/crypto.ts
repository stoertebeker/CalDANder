/**
 * AES-256-GCM encryption with PBKDF2 key derivation.
 * All credentials at rest are protected by the user's master passphrase.
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'

const PBKDF2_ITERATIONS = 310_000
const PBKDF2_KEYLEN = 32   // 256-bit key
const PBKDF2_DIGEST = 'sha256'
const SALT_BYTES = 32
const IV_BYTES = 12        // 96-bit IV — GCM standard
const TAG_BYTES = 16

export interface EncryptedBlob {
  salt: string  // hex
  iv: string    // hex
  tag: string   // hex
  data: string  // hex ciphertext
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
}

export function encrypt(plaintext: string, passphrase: string): EncryptedBlob {
  const salt = randomBytes(SALT_BYTES)
  const iv   = randomBytes(IV_BYTES)
  const key  = deriveKey(passphrase, salt)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return {
    salt: salt.toString('hex'),
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    data: encrypted.toString('hex')
  }
}

export function decrypt(blob: EncryptedBlob, passphrase: string): string {
  const salt = Buffer.from(blob.salt, 'hex')
  const iv   = Buffer.from(blob.iv, 'hex')
  const tag  = Buffer.from(blob.tag, 'hex')
  const data = Buffer.from(blob.data, 'hex')
  const key  = deriveKey(passphrase, salt)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
