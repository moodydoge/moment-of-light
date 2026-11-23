import type { Plugin } from 'vite'
import { WebSocketServer } from 'ws'
import { readBearer, verifyGuestToken } from './auth'
import { addClient } from './hub'
import { handleCompanionApiRequest } from './http'
import { getDb } from './db'

async function readNodeRequest(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export function viteCompanionPlugin(): Plugin {
  return {
    name: 'moment-of-light-companion',
    configureServer(server) {
      getDb()

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/companion')) {
          next()
          return
        }
        try {
          const host = req.headers.host || '127.0.0.1'
          const url = new URL(req.url, `http://${host}`)
          const body = await readNodeRequest(req)
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
          const response = await handleCompanionApiRequest(request)
          res.statusCode = response.status
          response.headers.forEach((value: string, key: string) => {
            res.setHeader(key, value)
          })
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Companion proxy error',
              code: 'PROXY_ERROR',
            }),
          )
        }
      })

      const wss = new WebSocketServer({ noServer: true })
      server.httpServer?.on('upgrade', (req, socket, head) => {
        const host = req.headers.host || '127.0.0.1'
        const url = new URL(req.url || '/', `http://${host}`)
        if (url.pathname !== '/api/companion/ws') return
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
        })
      })
    },
  }
}
