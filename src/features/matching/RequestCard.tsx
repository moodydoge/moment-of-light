import { Button } from '../../components/ui/Button'
import type { CompanionRequest } from '../../types'

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

const statusMap: Record<CompanionRequest['status'], string> = {
  open: '开放中',
  pending_confirm: '待确认',
  matched: '已匹配',
  cancelled: '已取消',
  expired: '已过期',
  closed: '已关闭',
}

export function RequestCard({
  request,
  onJoin,
  busy,
}: {
  request: CompanionRequest
  onJoin: (request: CompanionRequest) => void
  busy?: boolean
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-[var(--color-ink)]">{request.anonymousLabel}</h3>
        <span className="rounded-full bg-[var(--color-muted-bg)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]">
          {statusMap[request.status]}
          {request.demo ? ' · 演示' : ''}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {request.topicLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
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
          onClick={() => onJoin(request)}
        >
          愿意陪伴
        </Button>
      </div>
    </article>
  )
}
