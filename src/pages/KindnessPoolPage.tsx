import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useServices } from '../context/ServicesContext'
import { useSession } from '../context/SessionContext'
import { RequestCard } from '../features/matching/RequestCard'
import type { CompanionRequest } from '../types'

export function KindnessPoolPage() {
  const navigate = useNavigate()
  const { matching } = useServices()
  const { loadResponderSession } = useSession()
  const [requests, setRequests] = useState<CompanionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CompanionRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [emptyDemo, setEmptyDemo] = useState(false)

  const load = async (empty = emptyDemo) => {
    setLoading(true)
    setError(null)
    try {
      matching.setEmptyMode(empty)
      const list = await matching.listOpenRequests()
      setRequests(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        matching.setEmptyMode(false)
        const list = await matching.listOpenRequests()
        if (!cancelled) setRequests(list)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [matching])

  const confirmJoin = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await matching.applyToJoin(selected.id)
      await loadResponderSession(selected)
      setSelected(null)
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : '接入失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter space-y-6">
      <header>
        <h1 className="font-display text-2xl">看看善意</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          一次主动响应，就是一次轻量善意行动。请自主选择；不需要长期维持关系。
        </p>
      </header>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-ink-soft)]">
        <h2 className="mb-2 font-medium text-[var(--color-ink)]">陪伴规则</h2>
        <ul className="space-y-1">
          <li>仅展示匿名标识与通用话题标签，不展示联系方式或私密自由文本。</li>
          <li>接入需明确确认；双方可随时退出。</li>
          <li>这不是专业心理咨询，响应者不是危机处置人员。</li>
          <li>下列数据为演示请求，不代表真实在线用户。</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="text-sm"
          onClick={() => {
            setEmptyDemo(false)
            void load(false)
          }}
        >
          刷新列表
        </Button>
        <Button
          variant="ghost"
          className="text-sm"
          onClick={() => {
            setEmptyDemo(true)
            void load(true)
          }}
        >
          演示空状态
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#8B3A3A] dark:text-[#E8B4B4]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">加载中…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-muted-bg)]/50 px-4 py-10 text-center">
          <p className="text-[var(--color-ink)]">此刻还没有开放中的陪伴请求。</p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            你可以稍后再来，或先回到首页与 AI 聊聊。
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              busy={busy}
              onJoin={setSelected}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        title="确认接入陪伴？"
        onClose={() => setSelected(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)} disabled={busy}>
              取消
            </Button>
            <Button variant="human" onClick={() => void confirmJoin()} disabled={busy}>
              {busy ? '接入中…' : '确认愿意陪伴'}
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-2 text-sm">
            <p>
              你将接入「{selected.anonymousLabel}」。话题：
              {selected.topicLabels.join('、')}。
            </p>
            <p>请保持尊重，随时可以结束。本轮为演示会话，不开放真实匿名陌生人聊天室。</p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
