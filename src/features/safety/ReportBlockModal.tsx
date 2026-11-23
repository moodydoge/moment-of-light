import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useServices } from '../../context/ServicesContext'
import type { ReportReason } from '../../types'

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment', label: '骚扰或不尊重' },
  { id: 'inappropriate', label: '不当内容' },
  { id: 'crisis_concern', label: '可能涉及危机求助' },
  { id: 'spam', label: '骚扰式刷屏' },
  { id: 'other', label: '其他' },
]

interface ReportBlockModalProps {
  open: boolean
  sessionId: string
  onClose: () => void
  onBlocked?: () => void
}

export function ReportBlockModal({
  open,
  sessionId,
  onClose,
  onBlocked,
}: ReportBlockModalProps) {
  const { feedback } = useServices()
  const [reason, setReason] = useState<ReportReason>('harassment')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const submitReport = async () => {
    setBusy(true)
    try {
      await feedback.report({
        sessionId,
        target: 'human_participant',
        reason,
        detail: detail.trim() || undefined,
        demo: true,
      })
      setDone('已记录举报（演示）。正式环境将由服务端处理。')
    } finally {
      setBusy(false)
    }
  }

  const submitBlock = async () => {
    setBusy(true)
    try {
      await feedback.block({ sessionId, demo: true })
      setDone('已阻止对方（演示）。会话将结束。')
      onBlocked?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="举报或阻止"
      onClose={onClose}
      footer={
        done ? (
          <Button onClick={onClose}>知道了</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button variant="danger" onClick={() => void submitBlock()} disabled={busy}>
              阻止对方
            </Button>
            <Button onClick={() => void submitReport()} disabled={busy}>
              提交举报
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p>{done}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            你可以举报不当行为，或阻止对方继续交流。本入口在首轮为 UI 与接口边界演示。
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[var(--color-ink)]">举报原因</legend>
            {REASONS.map((item) => (
              <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="report-reason"
                  checked={reason === item.id}
                  onChange={() => setReason(item.id)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">补充说明（可选）</span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius-input)] border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2"
            />
          </label>
        </div>
      )}
    </Modal>
  )
}
