import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useSession } from '../context/SessionContext'
import { TopicCards } from '../features/companion/TopicCards'
import { MOOD_TAGS } from '../lib/topics'
import { cn } from '../lib/cn'

export function StartCompanionPage() {
  const navigate = useNavigate()
  const { startSession } = useSession()
  const [moodNote, setMoodNote] = useState('')
  const [topicIds, setTopicIds] = useState<string[]>(['say-anything'])
  const [moodTag, setMoodTag] = useState<string | null>('lonely')
  const [inviteLater, setInviteLater] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggleTopic = (id: string) => {
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3),
    )
  }

  const begin = async () => {
    setBusy(true)
    try {
      const tagLabel = MOOD_TAGS.find((t) => t.id === moodTag)?.label
      const note = [tagLabel, moodNote.trim()].filter(Boolean).join(' · ')
      await startSession({
        topicIds: topicIds.length ? topicIds : ['say-anything'],
        moodNote: note || undefined,
        inviteLater,
      })
      navigate('/chat')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter space-y-8">
      <header>
        <h1 className="font-display text-2xl text-[var(--color-ink)]">先聊一会儿</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          不必填写详细个人信息。你可以只选一个话题，或跳过文字直接开始。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-medium">此刻的感觉（可选）</h2>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setMoodTag((prev) => (prev === tag.id ? null : tag.id))}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm transition',
                moodTag === tag.id
                  ? 'border-[var(--color-action)] bg-[var(--color-action)]/10 text-[var(--color-action)]'
                  : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink-soft)]',
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--color-ink-soft)]">
            想说的一句话（可选，可跳过）
          </span>
          <textarea
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            rows={3}
            placeholder="例如：今天有点累，想随便说两句。"
            className="w-full rounded-[var(--radius-input)] border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 text-[16px]"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">话题卡（可多选）</h2>
        <TopicCards mode="select" selectedIds={topicIds} onSelect={toggleTopic} />
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="text-base font-medium">陪伴方式</h2>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="radio"
            name="mode"
            checked={!inviteLater}
            onChange={() => setInviteLater(false)}
            className="mt-1"
          />
          <span>
            <strong className="font-medium text-[var(--color-ink)]">仅与 AI 聊聊</strong>
            <br />
            默认模式。不会公开你的状态或聊天内容。
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="radio"
            name="mode"
            checked={inviteLater}
            onChange={() => setInviteLater(true)}
            className="mt-1"
          />
          <span>
            <strong className="font-medium text-[var(--color-ink)]">稍后邀请真人</strong>
            <br />
            先进入 AI 陪伴；准备好后再由你主动开放请求。
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button fullWidth onClick={() => void begin()} disabled={busy}>
          {busy ? '进入中…' : '开始陪伴'}
        </Button>
        <Button
          fullWidth
          variant="ghost"
          onClick={() => navigate('/')}
          disabled={busy}
        >
          返回
        </Button>
      </div>
    </div>
  )
}
