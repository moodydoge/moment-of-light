/**
 * Production / preview entry: static dist + AI + Companion REST + WebSocket.
 * Does not use Vite configureServer (dev-only).
 *
 * Usage (after npm run build):
 *   npx tsx server/prodServer.ts
 *   npm run start
 */
import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { handleAiApiRequest } from './aiHandler'
import { readBearer, verifyGuestToken } from './companion/auth'
import { getDb } from './companion/db'
import { addClient } from './companion/hub'
import { handleCompanionApiRequest } from './companion/http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')

function loadDotEnvFile(file: string) {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnvFile(path.join(root, '.env'))
loadDotEnvFile(path.join(root, '.env.production'))

const port = Number(process.env.PORT || process.env.MOL_PORT || 8788)
const host = process.env.MOL_HOST || '0.0.0.0'

function corsHeaders(req: import('node:http').IncomingMessage): Record<string, string> {
  const allowed = (process.env.MOL_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = req.headers.origin
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mol-Admin-Token',
  }
  if (allowed.length === 0) return headers
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers.Vary = 'Origin'
  }
  return headers
}

async function readBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
  }
  return map[ext] || 'application/octet-stream'
}

function safeJoinDist(urlPath: string) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/')
  const relative = decoded === '/' ? '/index.html' : decoded
  const candidate = path.normalize(path.join(distDir, relative))
  if (!candidate.startsWith(distDir)) return null
  return candidate
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  data: unknown,
  extraHeaders?: Record<string, string>,
) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(body)
}

getDb()

const server = createServer(async (req, res) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }

  try {
    const hostHeader = req.headers.host || `127.0.0.1:${port}`
    const url = new URL(req.url || '/', `http://${hostHeader}`)

    if (req.method === 'GET' && url.pathname === '/healthz') {
      sendJson(
        res,
        200,
        {
          ok: true,
          service: 'moment-of-light',
          publicOpen: false,
          inviteRequired: Boolean(process.env.MOL_COMPANION_INVITE_CODE?.trim()),
          node: process.version,
        },
        cors,
      )
      return
    }

    if (url.pathname.startsWith('/api/ai') || url.pathname.startsWith('/api/companion')) {
      const body = await readBody(req)
      const headerRecord: Record<string, string> = {}
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headerRecord[key] = value
        else if (Array.isArray(value)) headerRecord[key] = value.join(',')
      }
      const request = new Request(url, {
        method: req.method,
        headers: headerRecord,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      })
      const response = url.pathname.startsWith('/api/ai')
        ? await handleAiApiRequest(request)
        : await handleCompanionApiRequest(request)
      const outHeaders: Record<string, string> = { ...cors }
      response.headers.forEach((value, key) => {
        outHeaders[key] = value
      })
      res.writeHead(response.status, outHeaders)
      res.end(Buffer.from(await response.arrayBuffer()))
      return
    }

    if (!fs.existsSync(distDir)) {
      sendJson(
        res,
        503,
        {
          error: '前端尚未构建。请先执行 npm run build。',
          code: 'DIST_MISSING',
        },
        cors,
      )
      return
    }

    let filePath = safeJoinDist(url.pathname)
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html')
    }
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'Not found' }, cors)
      return
    }
    res.writeHead(200, { 'Content-Type': contentTypeFor(filePath), ...cors })
    fs.createReadStream(filePath).pipe(res)
  } catch (err) {
    sendJson(
      res,
      500,
      {
        error: err instanceof Error ? err.message : 'Server error',
        code: 'SERVER_ERROR',
      },
      cors,
    )
  }
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const hostHeader = req.headers.host || `127.0.0.1:${port}`
  const url = new URL(req.url || '/', `http://${hostHeader}`)
  if (url.pathname !== '/api/companion/ws') {
    socket.destroy()
    return
  }
  const token = url.searchParams.get('token') || readBearer(req.headers.authorization || null)
  const identity = verifyGuestToken(token)
  if (!identity) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    addClient(identity.userId, ws)
    ws.send(JSON.stringify({ type: 'connected', payload: { userId: identity.userId } }))
    const heartbeat = setInterval(() => {
      if (ws.readyState === 1) ws.ping()
    }, 15_000)
    ws.on('close', () => clearInterval(heartbeat))
  })
})

server.listen(port, host, () => {
  console.log(`[moment-of-light] prod listening on http://${host}:${port}`)
  console.log(
    `[moment-of-light] publicOpen=false inviteRequired=${Boolean(process.env.MOL_COMPANION_INVITE_CODE?.trim())}`,
  )
  if (!process.env.MOL_COMPANION_SECRET?.trim()) {
    console.warn(
      '[moment-of-light] WARNING: MOL_COMPANION_SECRET unset; tokens will not survive restarts.',
    )
  }
})

function shutdown(signal: string) {
  console.log(`[moment-of-light] shutting down (${signal})…`)
  wss.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 8_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
