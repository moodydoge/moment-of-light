/**
 * Optional standalone AI proxy for preview/production-like local runs.
 * Usage: node server/standalone.mjs
 * Requires MOL_AI_API_KEY in the environment (or a local .env loaded by your shell).
 */
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

async function loadHandler() {
  // Prefer compiled/bundled path via dynamic import of TS through vite-node if available;
  // for simplicity, re-implement a thin status/chat using the same env contract.
  const apiKey = process.env.MOL_AI_API_KEY?.trim()
  const baseUrl = (process.env.MOL_AI_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/+$/,
    '',
  )
  const model = process.env.MOL_AI_MODEL?.trim() || 'gpt-4o-mini'

  return { apiKey, baseUrl, model }
}

const { apiKey, baseUrl, model } = await loadHandler()
const port = Number(process.env.MOL_AI_PROXY_PORT || 8787)

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'GET' && url.pathname === '/api/ai/status') {
    res.end(
      JSON.stringify({
        configured: Boolean(apiKey),
        kind: apiKey ? 'live' : 'unavailable',
        model: apiKey ? model : null,
        baseUrlHost: new URL(baseUrl).host,
      }),
    )
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
    if (!apiKey) {
      res.statusCode = 503
      res.end(
        JSON.stringify({
          error: '真实 AI 尚未配置（MOL_AI_API_KEY）。',
          code: 'AI_NOT_CONFIGURED',
        }),
      )
      return
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const userMessage = String(body.userMessage || '').trim()
    if (!userMessage) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: '消息不能为空。', code: 'EMPTY_INPUT' }))
      return
    }

    try {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                '你是「此刻有光」的 AI 陪伴。温暖、自然、有边界；不假装真人；不替代专业心理支持。',
            },
            ...(Array.isArray(body.messages) ? body.messages.slice(-12) : []),
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      })
      if (!upstream.ok) {
        res.statusCode = 502
        res.end(
          JSON.stringify({
            error: `模型服务返回错误（HTTP ${upstream.status}）。`,
            code: 'UPSTREAM_ERROR',
          }),
        )
        return
      }
      const data = await upstream.json()
      const content = data.choices?.[0]?.message?.content?.trim()
      if (!content) {
        res.statusCode = 502
        res.end(JSON.stringify({ error: '模型返回空内容。', code: 'EMPTY_MODEL_OUTPUT' }))
        return
      }
      res.end(JSON.stringify({ content, model, demo: false, kind: 'live' }))
    } catch {
      res.statusCode = 502
      res.end(JSON.stringify({ error: '无法连接模型服务。', code: 'NETWORK_ERROR' }))
    }
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Not found' }))
}).listen(port, '127.0.0.1', () => {
  console.log(`[moment-of-light] AI proxy on http://127.0.0.1:${port}`)
  console.log(`[moment-of-light] configured=${Boolean(apiKey)} model=${apiKey ? model : 'n/a'}`)
  // silence unused
  void pathToFileURL
  void require
})
