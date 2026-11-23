import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export interface GuestIdentity {
  userId: string
  nickname: string
  adultAcknowledged: true
  iat: number
  exp: number
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12

function secret() {
  const fromEnv = process.env.MOL_COMPANION_SECRET?.trim()
  if (fromEnv) return fromEnv
  // Dev-only ephemeral secret — restarts invalidate tokens. Never use empty.
  if (!process.env.MOL_COMPANION_DEV_SECRET) {
    process.env.MOL_COMPANION_DEV_SECRET = randomBytes(24).toString('hex')
  }
  return process.env.MOL_COMPANION_DEV_SECRET
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString(
    'utf8',
  )
}

function sign(payloadB64: string) {
  return b64url(createHmac('sha256', secret()).update(payloadB64).digest())
}

export function issueGuestToken(input: {
  nickname?: string
  adultAcknowledged: boolean
}): { token: string; identity: GuestIdentity } {
  if (!input.adultAcknowledged) {
    throw new Error('必须确认本受控试点仅面向成年人（声明不等于严格年龄核验）。')
  }
  const now = Date.now()
  const identity: GuestIdentity = {
    userId: `u_${randomBytes(8).toString('hex')}`,
    nickname: sanitizeNick(input.nickname),
    adultAcknowledged: true,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  }
  const payloadB64 = b64url(JSON.stringify(identity))
  const token = `${payloadB64}.${sign(payloadB64)}`
  return { token, identity }
}

export function verifyGuestToken(token: string | null | undefined): GuestIdentity | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = sign(payloadB64)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const identity = JSON.parse(fromB64url(payloadB64)) as GuestIdentity
    if (!identity?.userId || identity.exp < Date.now()) return null
    if (identity.adultAcknowledged !== true) return null
    return identity
  } catch {
    return null
  }
}

function sanitizeNick(nickname?: string) {
  const raw = (nickname || '').trim().slice(0, 16)
  if (!raw) {
    const n = randomBytes(2).readUInt16BE(0) % 900 + 100
    return `路人灯火 ${n}`
  }
  return raw.replace(/[<>]/g, '')
}

export function readBearer(header: string | null): string | null {
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}
