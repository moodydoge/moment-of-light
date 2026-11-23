import { Button } from '../../components/ui/Button'
import { useSession } from '../../context/SessionContext'

export function DemoControlPanel() {
  const {
    session,
    demoApplyHuman,
    demoConfirmHuman,
    demoRejectHuman,
    demoHumanLeave,
    demoExpireRequest,
    demoFailNextSend,
  } = useSession()

  if (!session || session.role !== 'initiator' || !session.demo) return null

  const waiting =
    session.status === 'waiting_human' || session.status === 'human_requesting'
  const joined = session.status === 'human_joined'

  return (
    <section
      aria-label="演示控制"
      className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-muted-bg)]/60 p-4"
    >
      <h2 className="text-sm font-medium text-[var(--color-ink)]">演示控制（非正式能力）</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
        用于展示等待、申请、确认、加入、退出与发送失败。不会冒充真实在线用户。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="text-sm"
          disabled={!waiting || session.status !== 'waiting_human'}
          onClick={() => void demoApplyHuman()}
        >
          模拟有人申请
        </Button>
        <Button
          variant="human"
          className="text-sm"
          disabled={session.status !== 'human_requesting'}
          onClick={() => void demoConfirmHuman()}
        >
          确认对方加入
        </Button>
        <Button
          variant="secondary"
          className="text-sm"
          disabled={session.status !== 'human_requesting'}
          onClick={() => void demoRejectHuman()}
        >
          拒绝申请
        </Button>
        <Button
          variant="secondary"
          className="text-sm"
          disabled={!joined}
          onClick={() => void demoHumanLeave()}
        >
          模拟真人退出
        </Button>
        <Button
          variant="ghost"
          className="text-sm"
          disabled={!waiting}
          onClick={() => void demoExpireRequest()}
        >
          模拟请求超时
        </Button>
        <Button variant="danger" className="text-sm" onClick={demoFailNextSend}>
          下次发送失败
        </Button>
      </div>
    </section>
  )
}
