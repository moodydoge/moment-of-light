import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createId } from '../lib/id'
import {
  type AiGenerationStatus,
  generationStatusLabel,
  validateUserInput,
} from '../lib/aiLimits'
import { buildChatContext } from '../lib/chatContext'
import {
  canTransition,
  statusLabel,
  transitionSession,
  type SessionEvent,
} from '../lib/sessionMachine'
import { TOPIC_CARDS } from '../lib/topics'
import type {
  ChatMessage,
  CompanionRequest,
  CompanionSession,
  SessionMode,
} from '../types'
import { useServices } from './ServicesContext'

interface StartSessionInput {
  topicIds: string[]
  moodNote?: string
  inviteLater: boolean
}

interface SessionContextValue {
  session: CompanionSession | null
  messages: ChatMessage[]
  openRequest: CompanionRequest | null
  statusText: string
  sending: boolean
  aiThinking: boolean
  generationStatus: AiGenerationStatus
  generationStatusText: string
  error: string | null
  lastFailedUserMessage: string | null
  aiKind: 'demo' | 'live'
  aiModelLabel: string | null
  startSession: (input: StartSessionInput) => Promise<CompanionSession>
  sendMessage: (content: string) => Promise<void>
  sendTopicPrompt: (topicId: string) => Promise<void>
  fillTopicPrompt: (topicId: string) => string | null
  cancelGeneration: () => void
  retryLastFailed: () => Promise<void>
  openInviteConfirm: () => void
  cancelInviteConfirm: () => void
  confirmOpenRequest: () => Promise<void>
  cancelWaiting: () => Promise<void>
  demoApplyHuman: () => Promise<void>
  demoConfirmHuman: () => Promise<void>
  demoRejectHuman: () => Promise<void>
  demoHumanLeave: () => Promise<void>
  demoExpireRequest: () => Promise<void>
  demoFailNextSend: () => void
  endSession: () => void
  clearError: () => void
  loadResponderSession: (request: CompanionRequest) => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

function touch(session: CompanionSession, patch: Partial<CompanionSession>): CompanionSession {
  return { ...session, ...patch, updatedAt: new Date().toISOString() }
}

function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const services = useServices()
  const [session, setSession] = useState<CompanionSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [openRequest, setOpenRequest] = useState<CompanionRequest | null>(null)
  const [sending, setSending] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<AiGenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(null)
  const requestSeq = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const endedRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const sessionRef = useRef<CompanionSession | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const applyEvent = useCallback((event: SessionEvent) => {
    setSession((prev) => {
      if (!prev) return prev
      if (!canTransition(prev.status, event.type)) return prev
      const nextStatus = transitionSession(prev.status, event)
      let mode: SessionMode = prev.mode
      if (nextStatus === 'waiting_human' || nextStatus === 'human_requesting') {
        mode = 'human_invited'
      }
      if (nextStatus === 'human_joined') mode = 'human_joined'
      if (nextStatus === 'ai_chatting' && event.type !== 'START_AI') {
        mode = 'ai_only'
      }
      const next = touch(prev, {
        status: nextStatus,
        mode,
        humanJoinedAt:
          nextStatus === 'human_joined'
            ? new Date().toISOString()
            : nextStatus === 'human_left'
              ? prev.humanJoinedAt
              : undefined,
        endedAt: nextStatus === 'ended' ? new Date().toISOString() : prev.endedAt,
      })
      sessionRef.current = next
      return next
    })
  }, [])

  const pushSystem = useCallback(
    async (sessionId: string, content: string, isDemo = true) => {
      const msg: ChatMessage = {
        id: createId('msg'),
        sessionId,
        sender: 'system',
        senderLabel: '系统',
        content,
        createdAt: new Date().toISOString(),
        isDemo,
        status: 'sent',
      }
      await services.chat.appendMessage(msg)
      setMessages((prev) => {
        const next = [...prev, msg]
        messagesRef.current = next
        return next
      })
    },
    [services.chat],
  )

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    requestSeq.current += 1
    setAiThinking(false)
    setSending(false)
    setGenerationStatus((prev) => (prev === 'generating' ? 'cancelled' : prev))
  }, [])

  const requestAiReply = useCallback(
    async (sessionId: string, userMessage: string, topicIds: string[], seq: number) => {
      if (endedRef.current) return
      const controller = new AbortController()
      abortRef.current = controller
      setAiThinking(true)
      setGenerationStatus('generating')
      setError(null)

      try {
        const history = buildChatContext(messagesRef.current).slice(0, -1)
        const reply = await services.ai.reply({
          sessionId,
          userMessage,
          topicIds,
          history,
          signal: controller.signal,
        })
        if (seq !== requestSeq.current || endedRef.current) return
        await services.chat.appendMessage(reply)
        setMessages((prev) => {
          const next = [...prev, reply]
          messagesRef.current = next
          return next
        })
        setGenerationStatus('success')
        setLastFailedUserMessage(null)
      } catch (err) {
        if (seq !== requestSeq.current) return
        if (endedRef.current) return
        if (isAbortError(err) || controller.signal.aborted) {
          setGenerationStatus('cancelled')
          setError('已取消本次 AI 回复。')
          return
        }
        setGenerationStatus('failed')
        setLastFailedUserMessage(userMessage)
        setError(err instanceof Error ? err.message : 'AI 回复失败')
      } finally {
        if (seq === requestSeq.current) {
          setAiThinking(false)
          setSending(false)
          if (abortRef.current === controller) abortRef.current = null
        }
      }
    },
    [services.ai, services.chat],
  )

  const startSession = useCallback(
    async (input: StartSessionInput) => {
      cancelGeneration()
      endedRef.current = false
      const now = new Date().toISOString()
      const live = services.ai.kind === 'live'
      const next: CompanionSession = {
        id: createId('sess'),
        role: 'initiator',
        mode: 'ai_only',
        status: 'ai_chatting',
        topicIds: input.topicIds,
        moodNote: input.moodNote?.trim() || undefined,
        shareAiHistory: false,
        createdAt: now,
        updatedAt: now,
        demo: !live,
      }
      setSession(next)
      sessionRef.current = next
      setOpenRequest(null)
      setMessages([])
      messagesRef.current = []
      setError(null)
      setLastFailedUserMessage(null)
      setGenerationStatus('idle')
      services.chat.clearSession(next.id)

      const greeting: ChatMessage = {
        id: createId('msg'),
        sessionId: next.id,
        sender: 'ai',
        senderLabel: 'AI 陪伴',
        content: live
          ? '你好。我是 AI 陪伴（真实模型）。想聊什么都可以，也可以点下面的话题卡。我不是真人，也不能替代专业心理支持。'
          : '你好。我是 AI 陪伴（演示模式，回复由固定示例生成，不是真实大模型）。你想聊什么都可以，也可以点下面的话题卡。',
        createdAt: now,
        isDemo: !live,
        status: 'sent',
      }
      await services.chat.appendMessage(greeting)
      setMessages([greeting])
      messagesRef.current = [greeting]

      if (input.moodNote?.trim()) {
        const note = input.moodNote.trim()
        const noteMsg = await services.chat.sendUserMessage({
          sessionId: next.id,
          content: note,
        })
        setMessages((prev) => {
          const list = [...prev, noteMsg]
          messagesRef.current = list
          return list
        })
        const seq = ++requestSeq.current
        setSending(true)
        await requestAiReply(next.id, note, input.topicIds, seq)
      }

      if (input.inviteLater) {
        await pushSystem(
          next.id,
          '你选择了「稍后邀请真人」。可以先与 AI 聊聊，准备好后再点「邀请真人陪伴」。',
        )
      }

      return next
    },
    [cancelGeneration, pushSystem, requestAiReply, services.ai.kind, services.chat],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const current = sessionRef.current
      if (!current || current.status === 'ended' || endedRef.current) return
      if (aiThinking || sending) return

      const validationError = validateUserInput(content)
      if (validationError) {
        setError(validationError)
        return
      }
      const trimmed = content.trim()

      const seq = ++requestSeq.current
      setSending(true)
      setError(null)
      try {
        const userMsg = await services.chat.sendUserMessage({
          sessionId: current.id,
          content: trimmed,
        })
        if (seq !== requestSeq.current) return
        setMessages((prev) => {
          const next = [...prev, userMsg]
          messagesRef.current = next
          return next
        })

        if (current.status === 'human_joined') {
          const humanEcho: ChatMessage = {
            id: createId('msg'),
            sessionId: current.id,
            sender: 'human',
            senderLabel: '真人参与者',
            content:
              '（演示）我看到了你的消息。我们慢慢聊就好，随时可以结束。（演示模式 · 非真实用户）',
            createdAt: new Date().toISOString(),
            isDemo: true,
            status: 'sent',
          }
          await delay(500)
          if (seq !== requestSeq.current || endedRef.current) return
          await services.chat.appendMessage(humanEcho)
          setMessages((prev) => {
            const next = [...prev, humanEcho]
            messagesRef.current = next
            return next
          })
          setSending(false)
          return
        }

        await requestAiReply(current.id, trimmed, current.topicIds, seq)
      } catch (err) {
        if (seq !== requestSeq.current) return
        setGenerationStatus('failed')
        setLastFailedUserMessage(trimmed)
        setError(err instanceof Error ? err.message : '发送失败')
        setSending(false)
      }
    },
    [aiThinking, requestAiReply, sending, services.chat],
  )

  const sendTopicPrompt = useCallback(
    async (topicId: string) => {
      const topic = TOPIC_CARDS.find((t) => t.id === topicId)
      if (!topic) return
      await sendMessage(topic.prompt)
    },
    [sendMessage],
  )

  const fillTopicPrompt = useCallback((topicId: string) => {
    return TOPIC_CARDS.find((t) => t.id === topicId)?.prompt ?? null
  }, [])

  const retryLastFailed = useCallback(async () => {
    if (!lastFailedUserMessage || aiThinking) return
    await sendMessage(lastFailedUserMessage)
  }, [aiThinking, lastFailedUserMessage, sendMessage])

  const openInviteConfirm = useCallback(() => {
    applyEvent({ type: 'OPEN_INVITE_CONFIRM' })
  }, [applyEvent])

  const cancelInviteConfirm = useCallback(() => {
    applyEvent({ type: 'CANCEL_INVITE_CONFIRM' })
  }, [applyEvent])

  const confirmOpenRequest = useCallback(async () => {
    if (!session) return
    setError(null)
    try {
      const labels = TOPIC_CARDS.filter((t) => session.topicIds.includes(t.id)).map(
        (t) => t.label,
      )
      const request = await services.matching.openRequest({
        session,
        topicLabels: labels.length ? labels : ['轻量陪伴'],
      })
      setOpenRequest(request)
      applyEvent({ type: 'CONFIRM_OPEN_REQUEST' })
      await pushSystem(
        session.id,
        '已开放匿名陪伴请求（演示）。默认不分享此前 AI 私聊内容，仅展示你选择的话题标签。',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '开放请求失败')
    }
  }, [applyEvent, pushSystem, services.matching, session])

  const cancelWaiting = useCallback(async () => {
    if (!session) return
    if (openRequest) {
      await services.matching.cancelRequest(openRequest.id)
      setOpenRequest((prev) => (prev ? { ...prev, status: 'cancelled' } : prev))
    }
    applyEvent({ type: 'CANCEL_WAITING' })
    await pushSystem(session.id, '已取消真人陪伴请求。你可以继续与 AI 聊聊。')
  }, [applyEvent, openRequest, pushSystem, services.matching, session])

  const demoApplyHuman = useCallback(async () => {
    if (!session || !openRequest) return
    await services.matching.applyToJoin(openRequest.id)
    applyEvent({ type: 'HUMAN_APPLIES' })
    await pushSystem(
      session.id,
      '（演示控制）有人申请加入。需要你确认后，对方才会进入。非真实用户。',
    )
  }, [applyEvent, openRequest, pushSystem, services.matching, session])

  const demoConfirmHuman = useCallback(async () => {
    if (!session) return
    await services.matching.confirmJoin(session.id)
    applyEvent({ type: 'CONFIRM_HUMAN_JOIN' })
    setOpenRequest((prev) => (prev ? { ...prev, status: 'matched' } : prev))
    await pushSystem(
      session.id,
      '（演示）真人参与者已加入。双方可随时结束，这不是专业心理咨询。非真实用户。',
    )
  }, [applyEvent, pushSystem, services.matching, session])

  const demoRejectHuman = useCallback(async () => {
    if (!session) return
    await services.matching.rejectJoin(session.id)
    applyEvent({ type: 'REJECT_HUMAN_JOIN' })
    await pushSystem(session.id, '你已拒绝本次加入申请，请求重新进入等待。')
  }, [applyEvent, pushSystem, services.matching, session])

  const demoHumanLeave = useCallback(async () => {
    if (!session) return
    applyEvent({ type: 'HUMAN_LEAVES' })
    await pushSystem(session.id, '（演示）真人参与者已退出。你可以继续与 AI 交流或结束会话。')
  }, [applyEvent, pushSystem, session])

  const demoExpireRequest = useCallback(async () => {
    if (!session || !openRequest) return
    await services.matching.cancelRequest(openRequest.id)
    setOpenRequest((prev) => (prev ? { ...prev, status: 'expired' } : prev))
    applyEvent({ type: 'EXPIRE_REQUEST' })
    await pushSystem(session.id, '（演示）请求已超时/过期。你可以重新邀请，或继续 AI 陪伴。')
  }, [applyEvent, openRequest, pushSystem, services.matching, session])

  const demoFailNextSend = useCallback(() => {
    services.chat.setFailNextSend?.(true)
  }, [services.chat])

  const endSession = useCallback(() => {
    endedRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    requestSeq.current += 1
    setAiThinking(false)
    setSending(false)
    setGenerationStatus('ended')
    setSession((prev) => {
      if (!prev || prev.status === 'ended') return prev
      if (!canTransition(prev.status, 'END_SESSION')) {
        const next = touch(prev, {
          status: 'ended',
          endedAt: new Date().toISOString(),
        })
        sessionRef.current = next
        return next
      }
      const next = touch(prev, {
        status: transitionSession(prev.status, { type: 'END_SESSION' }),
        endedAt: new Date().toISOString(),
      })
      sessionRef.current = next
      return next
    })
  }, [])

  const loadResponderSession = useCallback(
    async (request: CompanionRequest) => {
      cancelGeneration()
      endedRef.current = false
      const now = new Date().toISOString()
      const next: CompanionSession = {
        id: createId('sess'),
        role: 'responder',
        mode: 'human_joined',
        status: 'human_joined',
        topicIds: [],
        shareAiHistory: false,
        createdAt: now,
        updatedAt: now,
        demo: true,
        humanJoinedAt: now,
      }
      setSession(next)
      sessionRef.current = next
      setOpenRequest(request)
      setError(null)
      setGenerationStatus('idle')
      services.chat.clearSession(next.id)
      const intro: ChatMessage = {
        id: createId('msg'),
        sessionId: next.id,
        sender: 'system',
        senderLabel: '系统',
        content: `你已确认接入「${request.anonymousLabel}」（演示会话）。请保持尊重，随时可以退出。这不是专业心理支持。`,
        createdAt: now,
        isDemo: true,
        status: 'sent',
      }
      const peer: ChatMessage = {
        id: createId('msg'),
        sessionId: next.id,
        sender: 'human',
        senderLabel: '发起者（匿名）',
        content: '（演示）谢谢你愿意花几分钟陪我聊聊。',
        createdAt: now,
        isDemo: true,
        status: 'sent',
      }
      await services.chat.appendMessage(intro)
      await services.chat.appendMessage(peer)
      setMessages([intro, peer])
      messagesRef.current = [intro, peer]
    },
    [cancelGeneration, services.chat],
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      messages,
      openRequest,
      statusText: session ? statusLabel(session.status) : '',
      sending,
      aiThinking,
      generationStatus,
      generationStatusText: generationStatusLabel(generationStatus),
      error,
      lastFailedUserMessage,
      aiKind: services.ai.kind,
      aiModelLabel: services.aiStatus.model,
      startSession,
      sendMessage,
      sendTopicPrompt,
      fillTopicPrompt,
      cancelGeneration,
      retryLastFailed,
      openInviteConfirm,
      cancelInviteConfirm,
      confirmOpenRequest,
      cancelWaiting,
      demoApplyHuman,
      demoConfirmHuman,
      demoRejectHuman,
      demoHumanLeave,
      demoExpireRequest,
      demoFailNextSend,
      endSession,
      clearError: () => setError(null),
      loadResponderSession,
    }),
    [
      session,
      messages,
      openRequest,
      sending,
      aiThinking,
      generationStatus,
      error,
      lastFailedUserMessage,
      services.ai.kind,
      services.aiStatus.model,
      startSession,
      sendMessage,
      sendTopicPrompt,
      fillTopicPrompt,
      cancelGeneration,
      retryLastFailed,
      openInviteConfirm,
      cancelInviteConfirm,
      confirmOpenRequest,
      cancelWaiting,
      demoApplyHuman,
      demoConfirmHuman,
      demoRejectHuman,
      demoHumanLeave,
      demoExpireRequest,
      demoFailNextSend,
      endSession,
      loadResponderSession,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
