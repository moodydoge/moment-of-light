import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GuestGate } from '../components/companion/GuestGate'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useCompanion } from '../context/CompanionContext'
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
import { TOPIC_CARDS } from '../lib/topics'
import type { ChatMessage } from '../types'

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
    cancelWaiting,
    endSession,
    aiKind,
    aiModelLabel,
  } = useSession()

  const companion = useCompanion()

  const [endOpen, setEndOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const composerRef = useRef<ChatComposerHandle>(null)

  const humanActive = companion.humanSession?.status === 'active'
  const waitingLive =
    Boolean(companion.myOpenRequestId) || companion.incoming.length > 0

  const responderWaiting =
    Boolean(companion.profile) && !session && !companion.humanSession

  const aiActive = Boolean(session && session.status !== 'ended')

  if (!session && !companion.humanSession && !companion.profile) {
    return <Navigate to="/start" replace />
  }
  // Only force feedback when the current round is ended and no fresh AI session exists.
  if (session?.status === 'ended' && companion.humanSession?.status !== 'active') {
    return <Navigate to="/feedback" replace />
  }
  if (companion.humanSession?.status === 'ended' && !aiActive) {
    return <Navigate to="/feedback" replace />
  }

  const confirmEnd = () => {
    if (humanActive) {
      void companion.endHumanSession().finally(() => {
        setEndOpen(false)
        navigate('/feedback')
      })
      return
    }
    endSession()
    setEndOpen(false)
    navigate('/feedback')
  }

  const modeBadge =
    aiKind === 'live'
      ? `真实 AI${aiModelLabel ? ` · ${aiModelLabel}` : ''}`
      : 'AI 演示适配器'

  const mergedMessages: ChatMessage[] = humanActive
    ? companion.humanMessages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        sender:
          m.senderRole === 'system'
            ? 'system'
            : m.senderId === companion.profile?.userId
              ? 'user'
              : 'human',
        senderLabel:
          m.senderRole === 'system'
            ? '系统'
            : m.senderId === companion.profile?.userId
              ? '你'
              : `${companion.humanSession?.peerNickname || '真人参与者'}（真人）`,
        content: m.content,
        createdAt: m.createdAt,
        isDemo: false,
        status: m.status === 'failed' ? 'failed' : m.status === 'sending' ? 'sending' : 'sent',
      }))
    : messages

  const onSend = async (content: string) => {
    setLocalError(null)
    if (humanActive) {
      try {
        await companion.sendHumanMessage(content)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : '发送失败')
      }
      return
    }
    await sendMessage(content)
  }

  const openLiveRequest = async () => {
    if (!companion.profile) {
      setLocalError('请先完成访客身份确认。')
      return
    }
    setInviteBusy(true)
    setLocalError(null)
    try {
      const topic =
        TOPIC_CARDS.find((t) => session?.topicIds.includes(t.id))?.label || '轻量陪伴'
      await companion.openRequest(topic)
      cancelInviteConfirm()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '开放请求失败')
    } finally {
      setInviteBusy(false)
    }
  }

  if (responderWaiting) {
    return (
      <div className="page-enter space-y-4">
        <h1 className="text-xl font-medium">等待发起者确认</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          你的申请已提交。发起者确认后会自动进入真人会话。也可以返回善意池。
        </p>
        <Button variant="secondary" onClick={() => navigate('/kindness')}>
          返回善意池
        </Button>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">陪伴聊天</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {humanActive
              ? `真人会话中 · 对方：${companion.humanSession?.peerNickname}`
              : `会话：${statusText || '—'} · 生成：${generationStatusText}`}
            <span className="mx-2">·</span>
            <span>{modeBadge}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(humanActive || waitingLive) && (
            <Button variant="ghost" className="text-sm" onClick={() => setReportOpen(true)}>
              举报/阻止
            </Button>
          )}
          <Button variant="danger" className="text-sm" onClick={() => setEndOpen(true)}>
            结束会话
          </Button>
        </div>
      </header>

      {companion.status?.kind === 'live-controlled' ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-human)]/40 bg-[var(--color-human)]/8 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          真人通道：受控试点（服务端身份 + 真实跨端同步）。未对公众无限制开放。
          {companion.profile ? ` 当前身份：${companion.profile.nickname}` : ''}
        </p>
      ) : null}

      {!companion.profile && companion.status?.available ? (
        <GuestGate title="邀请真人或响应请求前，请先获取访客身份" />
      ) : null}

      {aiKind !== 'live' ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-muted-bg)]/70 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          真实 AI 未启用时将使用演示适配器。配置 MOL_AI_API_KEY 后可切换。
        </p>
      ) : null}

      {error || localError ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[#D7B1B1] bg-[#F8ECEC] px-3 py-2 text-sm text-[#8B3A3A] dark:border-[#5A3A3A] dark:bg-[#3A2A2A] dark:text-[#E8B4B4] sm:flex-row sm:items-start sm:justify-between"
        >
          <span>{localError || error}</span>
          <div className="flex gap-2">
            {generationStatus === 'failed' && lastFailedUserMessage && !humanActive ? (
              <Button
                variant="secondary"
                className="px-3 text-sm"
                onClick={() => void retryLastFailed()}
              >
                重试
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="px-2 text-sm"
              onClick={() => {
                clearError()
                setLocalError(null)
              }}
            >
              关闭
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)]/70 p-3 sm:p-4">
        <ChatMessageList messages={mergedMessages} />
        {aiThinking && !humanActive ? (
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]" aria-live="polite">
            AI 陪伴正在生成回复…
          </p>
        ) : null}
      </div>

      {humanActive ? (
        <section className="space-y-2 rounded-[var(--radius-card)] border border-[var(--color-human)]/30 bg-[var(--color-human)]/8 p-4">
          <h2 className="text-sm font-medium text-[var(--color-human)]">可选 AI 辅助（不自动发言）</h2>
          <p className="text-xs text-[var(--color-ink-soft)]">
            真人加入后，AI 不会自动抢答或假装真人。建议仅供你参考，默认不写入双方聊天。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="text-sm"
              onClick={() => {
                void companion.fetchAiTip().then(setTip).catch((err) => {
                  setLocalError(err instanceof Error ? err.message : '获取建议失败')
                })
              }}
            >
              给我一个话题建议
            </Button>
            {tip ? (
              <Button
                variant="ghost"
                className="text-sm"
                onClick={() => composerRef.current?.setDraft(tip)}
              >
                填入输入框
              </Button>
            ) : null}
          </div>
          {tip ? <p className="text-sm text-[var(--color-ink)]">{tip}</p> : null}
        </section>
      ) : (
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
      )}

      {!humanActive &&
      session?.role === 'initiator' &&
      (session.status === 'ai_chatting' || Boolean(companion.myOpenRequestId) === false) &&
      !companion.myOpenRequestId ? (
        <Button
          variant="human"
          fullWidth
          onClick={() => {
            if (!companion.profile) {
              setLocalError('请先完成上方访客身份确认。')
              return
            }
            openInviteConfirm()
          }}
          disabled={aiThinking}
        >
          邀请真人陪伴
        </Button>
      ) : null}

      {companion.myOpenRequestId && !humanActive ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-human)]/30 bg-[var(--color-human)]/8 p-4">
          <p className="text-sm">
            已开放匿名陪伴请求（真实写入服务端）。AI 对话仍可继续。我们不会虚构预计响应时间。
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => {
                void companion.cancelMyRequest().catch((err) => {
                  setLocalError(err instanceof Error ? err.message : '取消失败')
                })
              }}
            >
              取消真人请求
            </Button>
          </div>
        </div>
      ) : null}

      {companion.incoming.length > 0 && !humanActive ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-human)]/30 bg-[var(--color-card)] p-4">
          <h2 className="text-sm font-medium">有人申请加入（需你确认）</h2>
          {companion.incoming.map((app) => (
            <div key={app.applicationId} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] pt-3">
              <div className="text-sm">
                <div>{app.responderNickname} 申请陪伴</div>
                <div className="text-xs text-[var(--color-ink-soft)]">话题：{app.topicTag}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="human"
                  className="text-sm"
                  onClick={() => {
                    void companion.acceptApplication(app.applicationId).catch((err) => {
                      setLocalError(err instanceof Error ? err.message : '接受失败')
                    })
                  }}
                >
                  接受
                </Button>
                <Button
                  variant="secondary"
                  className="text-sm"
                  onClick={() => {
                    void companion.rejectApplication(app.applicationId).catch((err) => {
                      setLocalError(err instanceof Error ? err.message : '拒绝失败')
                    })
                  }}
                >
                  拒绝
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!companion.status?.available && session ? <DemoControlPanel /> : null}

      {session && !humanActive && (session.status === 'waiting_human' || session.status === 'human_requesting') ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-soft)]">
          当前页面的演示匹配控件仅在 Companion 服务不可用时出现。可用时请使用上方真实申请/确认流程。
          <Button variant="ghost" className="ml-2 text-xs" onClick={() => void cancelWaiting()}>
            取消演示等待
          </Button>
        </div>
      ) : null}

      <ChatComposer
        ref={composerRef}
        sending={sending}
        generating={!humanActive && aiThinking}
        onSend={onSend}
        onCancel={cancelGeneration}
      />

      <InviteHumanPanel
        open={session?.status === 'invite_confirming'}
        loading={inviteBusy}
        onCancel={cancelInviteConfirm}
        onConfirm={() => {
          void openLiveRequest()
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
          结束后会停止真人消息与 AI 生成。默认不公开展示完整私聊。可自愿反馈。
        </p>
      </Modal>

      <ReportBlockModal
        open={reportOpen}
        sessionId={companion.humanSession?.id || session?.id || 'unknown'}
        onClose={() => setReportOpen(false)}
        onBlocked={() => {
          void companion.blockPeer().finally(confirmEnd)
        }}
        onReport={(reason, detail) => companion.report(reason, detail)}
      />
    </div>
  )
}
