const TOKEN_KEY = 'mol_companion_token'
const PROFILE_KEY = 'mol_companion_profile'

export interface CompanionProfile {
  token: string
  userId: string
  nickname: string
  kind: 'live-controlled'
}

export interface CompanionStatus {
  available: boolean
  kind: string
  publicOpen: boolean
  note?: string
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string; code?: string }
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  return data
}

export function loadStoredProfile(): CompanionProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CompanionProfile
  } catch {
    return null
  }
}

export function clearStoredProfile() {
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

function saveProfile(profile: CompanionProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  localStorage.setItem(TOKEN_KEY, profile.token)
}

export async function fetchCompanionStatus(): Promise<CompanionStatus> {
  try {
    const res = await fetch('/api/companion/status')
    if (!res.ok) return { available: false, kind: 'unavailable', publicOpen: false }
    return parse<CompanionStatus>(res)
  } catch {
    return { available: false, kind: 'unavailable', publicOpen: false }
  }
}

export async function ensureGuestProfile(input?: {
  nickname?: string
  adultAcknowledged?: boolean
}): Promise<CompanionProfile> {
  const existing = loadStoredProfile()
  if (existing?.token) {
    // Soft validate by listing requests; if 401, re-issue.
    try {
      await api('/api/companion/requests', { method: 'GET' }, existing.token)
      return existing
    } catch {
      clearStoredProfile()
    }
  }
  if (!input?.adultAcknowledged) {
    throw new Error('请先确认成年声明后进入受控真人试点。')
  }
  const res = await fetch('/api/companion/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: input.nickname,
      adultAcknowledged: true,
    }),
  })
  const data = await parse<{
    token: string
    userId: string
    nickname: string
    kind: 'live-controlled'
  }>(res)
  const profile: CompanionProfile = {
    token: data.token,
    userId: data.userId,
    nickname: data.nickname,
    kind: 'live-controlled',
  }
  saveProfile(profile)
  return profile
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const auth = token || loadStoredProfile()?.token
  if (!auth) throw new Error('缺少访客身份。')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${auth}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...init, headers })
  return parse<T>(res)
}

export function connectCompanionSocket(
  token: string,
  onEvent: (event: { type: string; payload?: unknown }) => void,
) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(
    `${proto}://${location.host}/api/companion/ws?token=${encodeURIComponent(token)}`,
  )
  ws.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(String(ev.data)) as { type: string; payload?: unknown })
    } catch {
      /* ignore */
    }
  }
  return ws
}

export function createClientMessageId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
