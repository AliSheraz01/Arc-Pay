import crypto from 'crypto'

const MASTER_ENCRYPTION_KEY = process.env.CHAT_SESSION_SECRET || 'easyzpay-arc-chat-to-pay-secret-key-32chars!'
const ENCRYPTION_KEY = crypto.createHash('sha256').update(MASTER_ENCRYPTION_KEY).digest()
const ALGORITHM = 'aes-256-gcm'

export function generatePairingToken(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let randomPart = ''
  const bytes = crypto.randomBytes(4)
  for (let i = 0; i < 4; i++) {
    randomPart += chars[bytes[i] % chars.length]
  }
  return `ARC-${randomPart}`
}

export function encryptPrivateKey(plainText: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decryptPrivateKey(cipherPayload: string): string {
  const parts = cipherPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format')
  }
  const [ivHex, authTagHex, encryptedData] = parts
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`
  }
  return cleaned
}
