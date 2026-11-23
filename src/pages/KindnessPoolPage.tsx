import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GuestGate } from '../components/companion/GuestGate'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useCompanion } from '../context/CompanionContext'

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function KindnessPoolPage() {
  const navigate = useNavigate()
  const {
    ready,
    status,
    profile,
    pool,
    refreshPool,
    applyToRequest,
    humanSession,
  } = useCompanion()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    void refreshPool()
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [profile, refreshPool])

  useEffect(() => {
    if (humanSession?.status === 'active') navigate('/chat')
  }, [humanSession, navigate])

  const selected = pool.find((item) => item.id === selectedId) || null

  return (
    <div className="page-enter space-y-6">
      <header>
        <h1 className="font-display text-2xl">看看善意</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          一次主动响应，就是一次轻量善意行动。列表来自服务端真实开放请求，不展示虚构在线人数。
        </p>
      </header>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-ink-soft)]">
        <h2 className="mb-2 font-medium text-[var(--color-ink)]">陪伴规则</h2>
        <ul className="space-y-1">
          <li>仅展示匿名标识与通用话题标签。</li>
          <li>接入需双方确认；可随时退出。</li>
          <li>这不是专业心理咨询，响应者不是危机处置人员。</li>
          <li>
            当前模式：
            {status?.kind === 'live-controlled' ? '受控试点（真实跨端同步）' : '服务不可用'}
            {status?.publicOpen ? '' : ' · 未对公众无限制开放'}
          </li>
        </ul>
      </section>

      {!profile ? <GuestGate /> : null}

      {profile ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <span>
              你是：{profile.nickname}（访客身份由服务端签发）
            </span>
            <Button
              variant="secondary"
              className="text-sm"
              onClick={() => {
                setLoading(true)
                void refreshPool()
                  .catch((err) => setError(err instanceof Error ? err.message : '刷新失败'))
                  .finally(() => setLoading(false))
              }}
            >
              刷新列表
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[#8B3A3A] dark:text-[#E8B4B4]">
              {error}
            </p>
          ) : null}

          {!ready || loading ? (
            <p className="text-sm text-[var(--color-ink-soft)]">加载中…</p>
          ) : pool.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-muted-bg)]/50 px-4 py-10 text-center">
              <p className="text-[var(--color-ink)]">此刻还没有开放中的陪伴请求。</p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => navigate('/')}>
                  返回首页
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pool.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{request.anonymousLabel}</h3>
                    <span className="rounded-full bg-[var(--color-muted-bg)] px-2.5 py-1 text-xs">
                      {request.status === 'open' ? '开放中' : request.status}
                      {request.kind === 'live-controlled' ? ' · 受控真实' : ''}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.topicLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                    发起时间：{formatTime(request.createdAt)}
                  </p>
                  <div className="mt-4">
                    <Button
                      variant="human"
                      fullWidth
                      disabled={busy || request.status !== 'open'}
                      onClick={() => setSelectedId(request.id)}
                    >
                      愿意陪伴
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      <Modal
        open={Boolean(selected)}
        title="确认接入陪伴？"
        onClose={() => setSelectedId(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedId(null)} disabled={busy}>
              取消
            </Button>
            <Button
              variant="human"
              disabled={busy}
              onClick={() => {
                if (!selected) return
                setBusy(true)
                setError(null)
                void applyToRequest(selected.id)
                  .then(() => {
                    setSelectedId(null)
                    navigate('/chat')
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : '申请失败'))
                  .finally(() => setBusy(false))
              }}
            >
              {busy ? '申请中…' : '确认愿意陪伴'}
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-2 text-sm">
            <p>
              你将申请接入「{selected.anonymousLabel}」。话题：
              {selected.topicLabels.join('、')}。
            </p>
            <p>申请后需等待发起者确认，才会进入对话。请保持尊重，随时可以结束。</p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
