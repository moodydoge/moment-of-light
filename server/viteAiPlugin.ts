import type { Plugin } from 'vite'
import { handleAiApiRequest } from './aiHandler'

/**
 * Dev-time AI proxy: keeps API keys on the Node side of Vite.
 */
export function viteAiPlugin(): Plugin {
  return {
    name: 'moment-of-light-ai-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ai')) {
          next()
          return
        }

        try {
          const host = req.headers.host || '127.0.0.1'
          const url = new URL(req.url, `http://${host}`)
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const body = Buffer.concat(chunks)
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

          const response = await handleAiApiRequest(request)
          res.statusCode = response.status
          response.headers.forEach((value: string, key: string) => {
            res.setHeader(key, value)
          })
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'AI proxy error',
              code: 'PROXY_ERROR',
            }),
          )
        }
      })
    },
  }
}
