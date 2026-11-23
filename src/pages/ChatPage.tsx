import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useSession } from '../context/SessionContext'
import {
  ChatComposer,
  type ChatComposerHandle,
} from '../features/companion/ChatComposer'
import { ChatMessageList } from '../features/companion/ChatMessageList'
import { DemoControlPanel } from '../features/companion/DemoControlPanel'
import { InviteHumanPanel } from '../features/companion/InviteHumanPanel'
import { TopicCards } from '../features/companion/TopicCards'
import { ReportBlockModal } from '../features/safety/ReportBlockModal'

export function ChatPage() {
  const navigate = useNavigate()
  const {
    session,
    messages,
    statusText,
    sending,
    aiThinking,
    generationStatus,
    generationStatusText,
    error,
    clearError,
    sendMessage,
    sendTopicPrompt,
    fillTopicPrompt,
    cancelGeneration,
    retryLastFailed,
    lastFailedUserMessage,
    openInviteConfirm,
    cancelInviteConfirm,
    confirmOpenRequest,
    cancelWaiting,
    demoConfirmHuman,
    demoRejectHuman,
    endSession,
    aiKind,
    aiModelLabel,
  } = useSession()

  const [endOpen, setEndOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [matchBusy, setMatchBusy] = useState(false)
  const composerRef = useRef<ChatComposerHandle>(null)

  if (!session) return <Navigate to="/start" replace />
  if (session.status === 'ended') return <Navigate to="/feedback" replace />

  const confirmEnd = () => {
    endSession()
    setEndOpen(false)
    navigate('/feedback')
  }

  const modeBadge =
    aiKind === 'live'
      ? `真实 AI${aiModelLabel ? ` · ${aiModelLabel}` : ''}`
      : 'AI 演示适配器'

  return (
    <div className="page-enter space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">陪伴聊天</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            会话：{statusText}
            <span className="mx-2">·</span>
            生成：{generationStatusText}
            <span className="mx-2">·</span>
            <span>{modeBadge}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(session.status === 'human_joined' ||
            session.status === 'human_requesting' ||
            session.status === 'waiting_human') && (
            <Button variant="ghost" className="text-sm" onClick={() => setReportOpen(true)}>
              举报/阻止
            </Button>
          )}
          <Button variant="danger" className="text-sm" onClick={() => setEndOpen(true)}>
            结束会话
          </Button>
        </div>
      </header>

      {aiKind !== 'live' ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-muted-bg)]/70 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          真实 AI 尚未配置或未启用。当前回复来自演示适配器，不会伪装成真实大模型。配置
          MOL_AI_API_KEY 后重启开发服务即可切换。
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[#D7B1B1] bg-[#F8ECEC] px-3 py-2 text-sm text-[#8B3A3A] dark:border-[#5A3A3A] dark:bg-[#3A2A2A] dark:text-[#E8B4B4] sm:flex-row sm:items-start sm:justify-between"
        >
          <span>{error}</span>
          <div className="flex gap-2">
            {generationStatus === 'failed' && lastFailedUserMessage ? (
              <Button
                variant="secondary"
                className="px-3 text-sm"
                onClick={() => void retryLastFailed()}
              >
                重试
              </Button>
            ) : null}
            <Button variant="ghost" className="px-2 text-sm" onClick={clearError}>
              关闭
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)]/70 p-3 sm:p-4">
        <ChatMessageList messages={messages} />
        {aiThinking ? (
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]" aria-live="polite">
            AI 陪伴正在生成回复…
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--color-ink-soft)]">话题卡</h2>
        <TopicCards
          mode="prompt"
          disabled={aiThinking || sending}
          onUsePrompt={(id) => {
            void sendTopicPrompt(id)
          }}
          onFillPrompt={(id) => {
            const text = fillTopicPrompt(id)
            if (text) composerRef.current?.setDraft(text)
          }}
        />
      </section>

      {session.role === 'initiator' && session.status === 'ai_chatting' ? (
        <Button variant="human" fullWidth onClick={openInviteConfirm} disabled={aiThinking}>
          邀请真人陪伴
        </Button>
      ) : null}

      {session.status === 'waiting_human' || session.status === 'human_requesting' ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-human)]/30 bg-[var(--color-human)]/8 p-4">
          <p className="text-sm text-[var(--color-ink)]">
            {session.status === 'waiting_human'
              ? '正在等待真人响应。AI 对话仍可继续。我们不会虚构预计响应时间。'
              : '有人申请加入。请确认后对方才会进入。'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {session.status === 'human_requesting' ? (
              <>
                <Button
                  variant="human"
                  disabled={matchBusy}
                  onClick={() => {
                    setMatchBusy(true)
                    void demoConfirmHuman().finally(() => setMatchBusy(false))
                  }}
                >
                  确认对方加入
                </Button>
                <Button
                  variant="secondary"
                  disabled={matchBusy}
                  onClick={() => {
                    setMatchBusy(true)
                    void demoRejectHuman().finally(() => setMatchBusy(false))
                  }}
                >
                  拒绝申请
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={() => void cancelWaiting()} disabled={matchBusy}>
              取消真人请求
            </Button>
          </div>
        </div>
      ) : null}

      <DemoControlPanel />

      <ChatComposer
        ref={composerRef}
        sending={sending}
        generating={aiThinking}
        onSend={sendMessage}
        onCancel={cancelGeneration}
      />

      <InviteHumanPanel
        open={session.status === 'invite_confirming'}
        loading={inviteBusy}
        onCancel={cancelInviteConfirm}
        onConfirm={() => {
          setInviteBusy(true)
          void confirmOpenRequest().finally(() => setInviteBusy(false))
        }}
      />

      <Modal
        open={endOpen}
        title="结束当前会话？"
        onClose={() => setEndOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              继续聊聊
            </Button>
            <Button variant="danger" onClick={confirmEnd}>
              确认结束
            </Button>
          </>
        }
      >
        <p className="text-sm">
          结束后会停止后续 AI 生成，可以留下简单反馈，也可以跳过。默认不会持久保存完整私聊记录。
        </p>
      </Modal>

      <ReportBlockModal
        open={reportOpen}
        sessionId={session.id}
        onClose={() => setReportOpen(false)}
        onBlocked={confirmEnd}
      />
    </div>
  )
}
