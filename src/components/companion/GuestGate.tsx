import { useState } from 'react'
import { Button } from '../ui/Button'
import { useCompanion } from '../../context/CompanionContext'

export function GuestGate({
  title = '进入受控真人试点',
  onReady,
}: {
  title?: string
  onReady?: () => void
}) {
  const { profile, bootstrapGuest, status } = useCompanion()
  const [nickname, setNickname] = useState('')
  const [adult, setAdult] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (profile) return null

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <h2 className="text-base font-medium text-[var(--color-ink)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        {status?.note ||
          '真人匹配为受控试点：服务端签发访客身份，不接受前端伪造 userId。尚未对公众无限制开放。'}
      </p>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-[var(--color-ink-soft)]">显示昵称（可匿名）</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 16))}
          className="w-full rounded-[var(--radius-input)] border border-[var(--color-line)] bg-[var(--color-page)] px-3 py-2.5"
          placeholder="例如：窗边的人"
        />
      </label>
      <label className="mt-3 flex min-h-11 items-start gap-2 text-sm text-[var(--color-ink-soft)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
        />
        <span>
          我确认自己是成年人，并理解这只是声明、不等于严格年龄核验。本受控试点仅面向成年人。
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[#8B3A3A] dark:text-[#E8B4B4]">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <Button
          fullWidth
          disabled={!adult || busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            void bootstrapGuest({ nickname, adultAcknowledged: true })
              .then(() => onReady?.())
              .catch((err) => setError(err instanceof Error ? err.message : '进入失败'))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? '进入中…' : '获取访客身份并继续'}
        </Button>
      </div>
    </section>
  )
}
