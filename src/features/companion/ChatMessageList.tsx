import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import type { ChatMessage } from '../../types'

export function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  return (
    <div className="flex flex-col gap-3" role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((msg) => (
        <article
          key={msg.id}
          className={cn(
            'max-w-[92%] rounded-[var(--radius-card)] border px-3.5 py-3',
            msg.sender === 'user' &&
              'ml-auto border-[var(--color-action)]/25 bg-[var(--color-action)]/10',
            msg.sender === 'ai' && 'border-[var(--color-line)] bg-[var(--color-card)]',
            msg.sender === 'human' &&
              'border-[var(--color-human)]/35 bg-[var(--color-human)]/10',
            msg.sender === 'system' &&
              'mx-auto max-w-full border-dashed border-[var(--color-line)] bg-transparent text-center',
          )}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                msg.sender === 'ai' && 'bg-[var(--color-muted-bg)] text-[var(--color-ink)]',
                msg.sender === 'user' && 'bg-[var(--color-action)]/15 text-[var(--color-action)]',
                msg.sender === 'human' && 'bg-[var(--color-human)]/20 text-[var(--color-human)]',
                msg.sender === 'system' && 'bg-transparent',
              )}
            >
              {msg.senderLabel}
            </span>
            {msg.isDemo ? <span>演示</span> : null}
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[var(--color-ink)]">
            {msg.content}
          </p>
        </article>
      ))}
      <div ref={endRef} />
    </div>
  )
}
