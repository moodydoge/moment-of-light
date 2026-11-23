import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useServices } from '../context/ServicesContext'
import { useSession } from '../context/SessionContext'
import type { SessionFeedback } from '../types'

type Choice = SessionFeedback['choice']

export function FeedbackPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { feedback } = useServices()
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!session) return <Navigate to="/" replace />

  const submit = async (choice: Choice) => {
    setBusy(true)
    try {
      await feedback.submit({
        sessionId: session.id,
        role: session.role,
        choice,
      })
      setSubmitted(true)
    } finally {
      setBusy(false)
    }
  }

  const initiatorChoices: { choice: Choice; label: string }[] = [
    { choice: 'felt_better', label: '这次交流让我感觉好一点' },
    { choice: 'not_helpful', label: '暂时没有帮助' },
  ]

  return (
    <div className="page-enter space-y-6">
      <header>
        <h1 className="font-display text-2xl">会话已结束</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          反馈是你的主观表达，不代表经过验证的心理改善。可以跳过。
        </p>
      </header>

      {submitted ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5">
          <p>感谢你的反馈。</p>
          <div className="mt-4">
            <Button onClick={() => navigate('/')}>回到首页</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {session.role === 'responder' ? (
            <Button
              fullWidth
              variant="human"
              disabled={busy}
              onClick={() => void submit('completed_companionship')}
            >
              我完成了一次陪伴
            </Button>
          ) : (
            initiatorChoices.map((item) => (
              <Button
                key={item.choice}
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => void submit(item.choice)}
              >
                {item.label}
              </Button>
            ))
          )}
          <Button
            fullWidth
            variant="ghost"
            disabled={busy}
            onClick={() => void submit('skipped')}
          >
            跳过反馈
          </Button>
        </div>
      )}
    </div>
  )
}
