import {
  COMPANION_SYSTEM_PROMPT,
  CRISIS_USER_HINT,
} from './companionPrompt'
import { loadAiRuntimeConfig, publicAiStatus } from './aiConfig'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatRequestBody {
  sessionId?: string
  messages?: ChatTurn[]
  userMessage?: string
}

const MAX_INPUT_CHARS = 500
const MAX_CONTEXT_TURNS = 12
const MAX_CONTEXT_CHARS = 2400
const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_WINDOW = 20
const MIN_INTERVAL_MS = 1200

const rateBuckets = new Map<string, { count: number; windowStart: number; lastAt: number }>()

const CRISIS_PATTERN =
  /自杀|自尽|不想活|结束生命|伤害自己|割腕|跳楼|轻生|活不下去|打死自己/

export function resetAiRateLimitForTests() {
  rateBuckets.clear()
}

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(headers ?? {}),
    },
  })
}

function trimContext(messages: ChatTurn[]): ChatTurn[] {
  const recent = messages.slice(-MAX_CONTEXT_TURNS).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 600),
  }))
  let total = recent.reduce((n, m) => n + m.content.length, 0)
  while (recent.length > 2 && total > MAX_CONTEXT_CHARS) {
    const removed = recent.shift()
    total -= removed?.content.length ?? 0
  }
  return recent
}

function checkRateLimit(sessionId: string): string | null {
  const now = Date.now()
  const bucket = rateBuckets.get(sessionId) ?? {
    count: 0,
    windowStart: now,
    lastAt: 0,
  }
  if (now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket.count = 0
    bucket.windowStart = now
  }
  if (now - bucket.lastAt < MIN_INTERVAL_MS) {
    return '发送过于频繁，请稍候再试。'
  }
  if (bucket.count >= RATE_MAX_PER_WINDOW) {
    return '本会话调用次数已达上限，请稍后再继续，或结束当前会话。'
  }
  bucket.count += 1
  bucket.lastAt = now
  rateBuckets.set(sessionId, bucket)
  return null
}

export async function handleAiStatusRequest(): Promise<Response> {
  const config = loadAiRuntimeConfig()
  return json(publicAiStatus(config))
}

export async function handleAiChatRequest(
  request: Request,
): Promise<Response> {
  const config = loadAiRuntimeConfig()
  if (!config.configured || !config.apiKey) {
    return json(
      {
        error:
          '真实 AI 尚未配置。请在本地设置 MOL_AI_API_KEY（及可选 MOL_AI_BASE_URL / MOL_AI_MODEL）后重启开发服务。密钥仅保存在服务端，不会进入浏览器。',
        code: 'AI_NOT_CONFIGURED',
      },
      503,
    )
  }

  let body: AiChatRequestBody
  try {
    body = (await request.json()) as AiChatRequestBody
  } catch {
    return json({ error: '请求体无效。', code: 'BAD_REQUEST' }, 400)
  }

  const sessionId = (body.sessionId || 'anonymous').slice(0, 64)
  const userMessage = (body.userMessage || '').trim()
  if (!userMessage) {
    return json({ error: '消息不能为空。', code: 'EMPTY_INPUT' }, 400)
  }
  if (userMessage.length > MAX_INPUT_CHARS) {
    return json(
      {
        error: `消息过长，请控制在 ${MAX_INPUT_CHARS} 字以内。`,
        code: 'INPUT_TOO_LONG',
      },
      400,
    )
  }

  const rateError = checkRateLimit(sessionId)
  if (rateError) {
    return json({ error: rateError, code: 'RATE_LIMITED' }, 429)
  }

  const history = Array.isArray(body.messages)
    ? trimContext(
        body.messages.filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string',
        ),
      )
    : []

  const maybeCrisis = CRISIS_PATTERN.test(userMessage)
  const messages = [
    { role: 'system' as const, content: COMPANION_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user' as const,
      content: maybeCrisis ? `${userMessage}\n\n${CRISIS_USER_HINT}` : userMessage,
    },
  ]

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  const onClientAbort = () => controller.abort()
  request.signal.addEventListener('abort', onClientAbort)

  try {
    const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: config.maxOutputTokens,
      }),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      // Do not forward provider payloads that may contain account details.
      return json(
        {
          error: `模型服务返回错误（HTTP ${upstream.status}）。请稍后重试，或检查模型名称与额度。`,
          code: 'UPSTREAM_ERROR',
          status: upstream.status,
        },
        502,
      )
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return json(
        { error: '模型返回空内容。', code: 'EMPTY_MODEL_OUTPUT' },
        502,
      )
    }

    return json({
      content,
      model: config.model,
      demo: false,
      kind: 'live',
    })
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') || request.signal.aborted
    if (aborted) {
      return json({ error: '生成已取消或超时。', code: 'ABORTED' }, 408)
    }
    return json(
      {
        error: '无法连接模型服务。请检查网络与 MOL_AI_BASE_URL。',
        code: 'NETWORK_ERROR',
      },
      502,
    )
  } finally {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', onClientAbort)
  }
}

export async function handleAiApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/api/ai/status') {
    return handleAiStatusRequest()
  }
  if (request.method === 'POST' && url.pathname === '/api/ai/chat') {
    return handleAiChatRequest(request)
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  return json({ error: 'Not found' }, 404)
}
