import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  handleAiChatRequest,
  handleAiStatusRequest,
  resetAiRateLimitForTests,
} from './aiHandler'

afterEach(() => {
  resetAiRateLimitForTests()
  vi.unstubAllGlobals()
  delete process.env.MOL_AI_API_KEY
  delete process.env.MOL_AI_BASE_URL
  delete process.env.MOL_AI_MODEL
})

describe('aiHandler', () => {
  it('reports unavailable when key missing', async () => {
    const res = await handleAiStatusRequest()
    const body = await res.json()
    expect(body.configured).toBe(false)
    expect(body.kind).toBe('unavailable')
  })

  it('returns clear 503 when chat called without key', async () => {
    const res = await handleAiChatRequest(
      new Request('http://local/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', userMessage: '你好' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('AI_NOT_CONFIGURED')
  })

  it('rejects empty and long input when configured', async () => {
    process.env.MOL_AI_API_KEY = 'test-key'
    const empty = await handleAiChatRequest(
      new Request('http://local/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', userMessage: '  ' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(empty.status).toBe(400)

    const long = await handleAiChatRequest(
      new Request('http://local/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 's1',
          userMessage: 'x'.repeat(501),
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(long.status).toBe(400)
  })

  it('proxies OpenAI-compatible chat completions without leaking key', async () => {
    process.env.MOL_AI_API_KEY = 'secret-key-should-not-echo'
    process.env.MOL_AI_MODEL = 'gpt-4o-mini'
    process.env.MOL_AI_BASE_URL = 'https://example.test/v1'

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const parsed = JSON.parse(String(init?.body || '{}')) as {
          messages: Array<{ role: string; content: string }>
        }
        expect(parsed.messages[0]?.role).toBe('system')
        expect(String(init?.headers)).not.toContain('secret-key-should-not-echo')
        // Authorization header exists server-side only
        const headers = new Headers(init?.headers)
        expect(headers.get('Authorization')).toBe('Bearer secret-key-should-not-echo')
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '你好，我在这儿。' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )

    const res = await handleAiChatRequest(
      new Request('http://local/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 's1',
          userMessage: '今天有点累',
          messages: [{ role: 'user', content: '之前说过一句话' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content).toContain('你好')
    expect(body.demo).toBe(false)
    expect(JSON.stringify(body)).not.toContain('secret-key-should-not-echo')
  })

  it('maps upstream failures to explicit errors', async () => {
    process.env.MOL_AI_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    const res = await handleAiChatRequest(
      new Request('http://local/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', userMessage: '你好' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('UPSTREAM_ERROR')
  })
})
