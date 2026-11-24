/** Resolve API / WS URLs. Empty VITE_MOL_API_BASE means same-origin. */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_MOL_API_BASE as string | undefined) || ''
  return raw.replace(/\/+$/, '')
}

export function apiUrl(path: string): string {
  const base = apiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export function wsUrl(pathWithQuery: string): string {
  const base = apiBase()
  if (!base) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}${pathWithQuery}`
  }
  const u = new URL(base)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  return `${u.origin}${path}`
}
