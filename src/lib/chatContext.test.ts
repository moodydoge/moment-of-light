import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../types'
import { buildChatContext } from './chatContext'

function msg(
  partial: Pick<ChatMessage, 'sender' | 'content'> & Partial<ChatMessage>,
): ChatMessage {
  return {
    id: partial.id ?? 'm',
    sessionId: 's',
    senderLabel: partial.sender,
    createdAt: new Date().toISOString(),
    status: 'sent',
    ...partial,
  }
}

describe('buildChatContext', () => {
  it('keeps only user/ai turns and trims to recent window', () => {
    const messages = [
      msg({ sender: 'system', content: 'sys' }),
      msg({ sender: 'user', content: 'u1' }),
      msg({ sender: 'ai', content: 'a1' }),
      msg({ sender: 'user', content: 'u2' }),
      msg({ sender: 'ai', content: 'a2', status: 'failed' }),
    ]
    expect(buildChatContext(messages)).toEqual([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
    ])
  })
})
