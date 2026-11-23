import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

interface InviteHumanPanelProps {
  open: boolean
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function InviteHumanPanel({
  open,
  loading,
  onCancel,
  onConfirm,
}: InviteHumanPanelProps) {
  return (
    <Modal
      open={open}
      title="邀请真人陪伴前，请确认"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button variant="human" onClick={onConfirm} disabled={loading}>
            {loading ? '开放中…' : '确认开放请求'}
          </Button>
        </>
      }
    >
      <ul className="space-y-2 text-sm leading-relaxed">
        <li>请求会出现在「看看善意」列表中，可能被其他用户看到。</li>
        <li>
          将展示：匿名标识、你选择的话题标签、发起时间与状态。不会展示联系方式、精确位置。
        </li>
        <li>
          <strong className="font-medium text-[var(--color-ink)]">默认不分享</strong>
          此前与 AI 的私聊历史。
        </li>
        <li>你可以随时取消等待或结束会话。双方确认后，对方才会加入。</li>
        <li>真人陪伴不是专业心理支持；紧急情况请使用当地求助渠道。</li>
      </ul>
      <p className="mt-3 rounded-lg bg-[var(--color-muted-bg)] px-3 py-2 text-xs">
        演示说明：本轮不会创建真实陌生人聊天室，匹配流程仅供界面演示。
      </p>
    </Modal>
  )
}
