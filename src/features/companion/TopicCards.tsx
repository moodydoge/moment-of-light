import { TOPIC_CARDS } from '../../lib/topics'
import { cn } from '../../lib/cn'

interface TopicCardsProps {
  selectedIds?: string[]
  onSelect?: (id: string) => void
  onUsePrompt?: (id: string) => void
  onFillPrompt?: (id: string) => void
  mode?: 'select' | 'prompt'
  disabled?: boolean
}

export function TopicCards({
  selectedIds = [],
  onSelect,
  onUsePrompt,
  onFillPrompt,
  mode = 'prompt',
  disabled,
}: TopicCardsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {TOPIC_CARDS.map((card) => {
        const selected = selectedIds.includes(card.id)
        return (
          <div
            key={card.id}
            className={cn(
              'rounded-[var(--radius-card)] border px-3 py-3 text-left transition motion-safe-only',
              selected
                ? 'border-[var(--color-action)] bg-[var(--color-action)]/10'
                : 'border-[var(--color-line)] bg-[var(--color-card)]',
              !disabled && mode === 'select' && 'hover:-translate-y-0.5 hover:border-[var(--color-action)]/40',
            )}
          >
            {mode === 'select' ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect?.(card.id)}
                className="min-h-11 w-full text-left disabled:opacity-50"
              >
                <div className="text-sm font-medium text-[var(--color-ink)]">{card.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                  {card.prompt}
                </p>
              </button>
            ) : (
              <>
                <div className="text-sm font-medium text-[var(--color-ink)]">{card.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                  {card.prompt}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onUsePrompt?.(card.id)}
                    className="min-h-11 rounded-full border border-[var(--color-line)] bg-[var(--color-muted-bg)] px-3 text-xs text-[var(--color-ink)] disabled:opacity-50"
                  >
                    直接发送
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onFillPrompt?.(card.id)}
                    className="min-h-11 rounded-full border border-[var(--color-line)] px-3 text-xs text-[var(--color-ink-soft)] disabled:opacity-50"
                  >
                    填入输入框
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
