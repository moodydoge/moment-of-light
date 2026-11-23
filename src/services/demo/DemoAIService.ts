import type { ChatMessage } from '../../types'
import { createId } from '../../lib/id'
import { TOPIC_CARDS } from '../../lib/topics'
import type { AiReplyInput, CompanionAIService } from '../contracts'

const DEMO_REPLIES = [
  '我在这儿陪你。你愿意的话，可以慢慢说；不想说也没关系。（演示模式 · 非真实大模型）',
  '听起来你此刻需要一点空间。我们可以先聊一件很小的事。（演示模式 · 非真实大模型）',
  '谢谢你愿意开口。我会用简短、温和的方式回应你。（演示模式 · 非真实大模型）',
  '如果你只是想待一会儿，也可以。我不会催你继续。（演示模式 · 非真实大模型）',
]

export class DemoAIService implements CompanionAIService {
  readonly kind = 'demo' as const
  private replyIndex = 0

  async getTopicCards() {
    return TOPIC_CARDS
  }

  async reply(input: AiReplyInput): Promise<ChatMessage> {
    await abortableDelay(450 + Math.random() * 350, input.signal)
    if (input.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const topic = TOPIC_CARDS.find((t) => input.topicIds.includes(t.id))
    const base = DEMO_REPLIES[this.replyIndex % DEMO_REPLIES.length]
    this.replyIndex += 1
    const content = topic
      ? `${base}\n\n关于「${topic.label}」：可以顺着这个话题继续，也可以换一个你更想说的。`
      : base

    return {
      id: createId('msg'),
      sessionId: input.sessionId,
      sender: 'ai',
      senderLabel: 'AI 陪伴',
      content,
      createdAt: new Date().toISOString(),
      isDemo: true,
      status: 'sent',
    }
  }
}

function abortableDelay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
