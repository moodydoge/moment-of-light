import type { ChatMessage } from '../types'
import { AI_MAX_CONTEXT_MESSAGES } from './aiLimits'

export interface CompactTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Build compact model context from in-memory messages only (no persistence). */
export function buildChatContext(messages: ChatMessage[]): CompactTurn[] {
  const turns: CompactTurn[] = []
  for (const msg of messages) {
    if (msg.sender === 'user' && msg.status !== 'failed') {
      turns.push({ role: 'user', content: msg.content })
    } else if (msg.sender === 'ai' && msg.status !== 'failed') {
      turns.push({ role: 'assistant', content: msg.content })
    }
  }
  return turns.slice(-AI_MAX_CONTEXT_MESSAGES)
}
