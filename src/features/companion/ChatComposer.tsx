import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Button } from '../../components/ui/Button'
import { AI_MAX_INPUT_CHARS } from '../../lib/aiLimits'

export interface ChatComposerHandle {
  setDraft: (value: string) => void
  focus: () => void
}

interface ChatComposerProps {
  disabled?: boolean
  sending?: boolean
  generating?: boolean
  onSend: (content: string) => Promise<void> | void
  onCancel?: () => void
  placeholder?: string
}

/**
 * Handles CJK IME composition: Enter during composition must not send.
 */
export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      disabled,
      sending,
      generating,
      onSend,
      onCancel,
      placeholder = '想说的话…',
    },
    ref,
  ) {
    const [value, setValue] = useState('')
    const composingRef = useRef(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      setDraft: (next) => {
        setValue(next.slice(0, AI_MAX_INPUT_CHARS))
        textareaRef.current?.focus()
      },
      focus: () => textareaRef.current?.focus(),
    }))

    useEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`
    }, [value])

    const busy = Boolean(disabled || sending || generating)

    const submit = async () => {
      if (composingRef.current || busy) return
      const next = value.trim()
      if (!next) return
      setValue('')
      await onSend(next)
    }

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      if (e.nativeEvent.isComposing || composingRef.current) return
      e.preventDefault()
      void submit()
    }

    const onSubmit = (e: FormEvent) => {
      e.preventDefault()
      void submit()
    }

    return (
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-[var(--color-line)] bg-[var(--color-page)]/95 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
      >
        <div className="mb-1 flex justify-between text-xs text-[var(--color-ink-soft)]">
          <span>最多 {AI_MAX_INPUT_CHARS} 字</span>
          <span>
            {value.length}/{AI_MAX_INPUT_CHARS}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-input">
            消息输入
          </label>
          <textarea
            ref={textareaRef}
            id="chat-input"
            rows={2}
            value={value}
            maxLength={AI_MAX_INPUT_CHARS}
            disabled={disabled || generating}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value.slice(0, AI_MAX_INPUT_CHARS))}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            onKeyDown={onKeyDown}
            className="min-h-11 max-h-[140px] flex-1 resize-none rounded-[var(--radius-input)] border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]"
          />
          {generating ? (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={onCancel}
            >
              取消
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={disabled || sending || !value.trim()}
              className="shrink-0"
            >
              {sending ? '发送中' : '发送'}
            </Button>
          )}
        </div>
      </form>
    )
  },
)
