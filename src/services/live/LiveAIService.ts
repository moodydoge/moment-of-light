import { apiUrl } from '../../lib/apiBase'
import { createId } from '../../lib/id'
import { TOPIC_CARDS } from '../../lib/topics'
import type { ChatMessage } from '../../types'
import type { AiReplyInput, CompanionAIService } from '../contracts'

export class AiRequestError extends Error {
  code: string
  constructor(message: string, code = 'AI_ERROR') {
    super(message)
    this.name = 'AiRequestError'
    this.code = code
  }
}

export class LiveAIService implements CompanionAIService {
  readonly kind = 'live' as const

  async getTopicCards() {
    return TOPIC_CARDS
  }

  async reply(input: AiReplyInput): Promise<ChatMessage> {
    const response = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: input.signal,
      body: JSON.stringify({
        sessionId: input.sessionId,
        userMessage: input.userMessage,
        messages: input.history ?? [],
      }),
    })

    let payload: {
      content?: string
      error?: string
      code?: string
      demo?: boolean
    } = {}
    try {
      payload = (await response.json()) as typeof payload
    } catch {
      throw new AiRequestError('无法解析模型响应。', 'BAD_RESPONSE')
    }

    if (!response.ok) {
      throw new AiRequestError(
        payload.error || `AI 请求失败（HTTP ${response.status}）`,
        payload.code || 'HTTP_ERROR',
      )
    }

    const content = payload.content?.trim()
    if (!content) {
      throw new AiRequestError('模型返回空内容。', 'EMPTY_MODEL_OUTPUT')
    }

    return {
      id: createId('msg'),
      sessionId: input.sessionId,
      sender: 'ai',
      senderLabel: 'AI 陪伴',
      content,
      createdAt: new Date().toISOString(),
      isDemo: false,
      status: 'sent',
    }
  }
}

export async function fetchAiStatus(): Promise<{
  configured: boolean
  kind: 'live' | 'unavailable'
  model: string | null
  baseUrlHost?: string
}> {
  try {
    const res = await fetch(apiUrl('/api/ai/status'))
    if (!res.ok) {
      return { configured: false, kind: 'unavailable', model: null }
    }
    return (await res.json()) as {
      configured: boolean
      kind: 'live' | 'unavailable'
      model: string | null
      baseUrlHost?: string
    }
  } catch {
    return { configured: false, kind: 'unavailable', model: null }
  }
}
