import type { ChatMessage } from '../../types'
import { createId } from '../../lib/id'
import type { ChatService } from '../contracts'

export class DemoChatService implements ChatService {
  readonly kind = 'demo' as const
  private messages = new Map<string, ChatMessage[]>()
  private failNextSend = false

  setFailNextSend(fail: boolean) {
    this.failNextSend = fail
  }

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    return [...(this.messages.get(sessionId) ?? [])]
  }

  async sendUserMessage(input: {
    sessionId: string
    content: string
  }): Promise<ChatMessage> {
    await delay(200)
    if (this.failNextSend) {
      this.failNextSend = false
      throw new Error('演示：消息发送失败，请重试。')
    }

    const message: ChatMessage = {
      id: createId('msg'),
      sessionId: input.sessionId,
      sender: 'user',
      senderLabel: '你',
      content: input.content.trim(),
      createdAt: new Date().toISOString(),
      status: 'sent',
    }
    this.appendLocal(message)
    return message
  }

  async appendMessage(message: ChatMessage): Promise<ChatMessage> {
    this.appendLocal(message)
    return message
  }

  clearSession(sessionId: string) {
    this.messages.delete(sessionId)
  }

  private appendLocal(message: ChatMessage) {
    const list = this.messages.get(message.sessionId) ?? []
    list.push(message)
    this.messages.set(message.sessionId, list)
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
