import type { TopicCard } from '../types'

/** Static topic cards — do not call the model to regenerate these each turn. */
export const TOPIC_CARDS: TopicCard[] = [
  {
    id: 'say-anything',
    label: '今天有什么想说的吗？',
    prompt: '今天有什么想说的吗？我想先随便聊聊。',
  },
  {
    id: 'small-thing',
    label: '聊聊最近一件小事',
    prompt: '想和你聊聊最近一件小事。',
  },
  {
    id: 'just-chat',
    label: '不知道说什么？我们随便聊聊',
    prompt: '我不太知道说什么，我们随便聊聊吧。',
  },
]

export const MOOD_TAGS = [
  { id: 'tired', label: '有点累' },
  { id: 'lonely', label: '想说说话' },
  { id: 'calm', label: '只是路过' },
] as const
