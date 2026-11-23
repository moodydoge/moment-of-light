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
import {
  api,
  connectCompanionSocket,
  createClientMessageId,
  ensureGuestProfile,
  fetchCompanionStatus,
  loadStoredProfile,
  type CompanionProfile,
  type CompanionStatus,
} from '../services/companion/client'

export interface PoolRequest {
  id: string
  anonymousLabel: string
  topicLabels: string[]
  createdAt: string
  expiresAt?: string
  status: string
  demo: boolean
  kind?: string
  humanSessionId?: string | null
}

export interface IncomingApplication {
  applicationId: string
  requestId: string
  responderId: string
  responderNickname: string
  topicTag: string
  createdAt: string
  status: string
}

export interface HumanSession {
  id: string
  requestId: string
  requesterId: string
  responderId: string
  status: 'active' | 'ended'
  startedAt: string
  endedAt: string | null
  role: 'requester' | 'responder'
  peerNickname: string
  kind: 'live-controlled'
}

export interface HumanMessage {
  id: string
  sessionId: string
  senderId: string
  senderRole: string
  content: string
  createdAt: string
  clientMessageId: string
  status?: 'sending' | 'sent' | 'failed'
}

interface CompanionContextValue {
  status: CompanionStatus | null
  profile: CompanionProfile | null
  ready: boolean
  error: string | null
  pool: PoolRequest[]
  incoming: IncomingApplication[]
  humanSession: HumanSession | null
  humanMessages: HumanMessage[]
  myOpenRequestId: string | null
  bootstrapGuest: (input: { nickname?: string; adultAcknowledged: boolean }) => Promise<void>
  refreshPool: () => Promise<void>
  refreshIncoming: () => Promise<void>
  openRequest: (topicTag: string) => Promise<PoolRequest>
  cancelMyRequest: () => Promise<void>
  applyToRequest: (requestId: string) => Promise<void>
  acceptApplication: (applicationId: string) => Promise<void>
  rejectApplication: (applicationId: string) => Promise<void>
  sendHumanMessage: (content: string) => Promise<void>
  retryHumanMessage: (clientMessageId: string) => Promise<void>
  endHumanSession: () => Promise<void>
  report: (reason: string, detail?: string) => Promise<void>
  blockPeer: () => Promise<void>
  fetchAiTip: () => Promise<string>
  submitFeedback: (feedback: string, role: string) => Promise<void>
  /** Clear ended human round so a new AI/human flow can start. */
  clearHumanRound: () => void
  clearError: () => void
}

const CompanionContext = createContext<CompanionContextValue | null>(null)

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CompanionStatus | null>(null)
  const [profile, setProfile] = useState<CompanionProfile | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pool, setPool] = useState<PoolRequest[]>([])
  const [incoming, setIncoming] = useState<IncomingApplication[]>([])
  const [humanSession, setHumanSession] = useState<HumanSession | null>(null)
  const [humanMessages, setHumanMessages] = useState<HumanMessage[]>([])
  const [myOpenRequestId, setMyOpenRequestId] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sessionRef = useRef<HumanSession | null>(null)

  useEffect(() => {
    sessionRef.current = humanSession
  }, [humanSession])

  const refreshPool = useCallback(async () => {
    if (!loadStoredProfile()) return
    const data = await api<{ items: PoolRequest[] }>('/api/companion/requests')
    setPool(data.items)
  }, [])

  const refreshIncoming = useCallback(async () => {
    if (!loadStoredProfile()) return
    const data = await api<{ items: IncomingApplication[] }>(
      '/api/companion/applications/incoming',
    )
    setIncoming(data.items)
  }, [])

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const data = await api<{ items: HumanMessage[] }>(
      `/api/companion/sessions/${sessionId}/messages`,
    )
    setHumanMessages(data.items.map((m) => ({ ...m, status: 'sent' })))
  }, [])

  const attachSocket = useCallback(
    (token: string) => {
      wsRef.current?.close()
      wsRef.current = connectCompanionSocket(token, (event) => {
        if (event.type === 'request_pool_changed' || event.type === 'application_created') {
          void refreshPool()
          void refreshIncoming()
        }
        if (event.type === 'session_started') {
          const payload = event.payload as { sessionId?: string }
          if (payload.sessionId) {
            void api<HumanSession>(`/api/companion/sessions/${payload.sessionId}`).then(
              async (session) => {
                setHumanSession(session)
                setMyOpenRequestId(null)
                await loadSessionMessages(session.id)
              },
            )
          }
        }
        if (event.type === 'message_created') {
          const payload = event.payload as { sessionId?: string; message?: HumanMessage }
          if (!payload.message || !payload.sessionId) return
          if (sessionRef.current?.id !== payload.sessionId) return
          setHumanMessages((prev) => {
            if (prev.some((m) => m.id === payload.message!.id || m.clientMessageId === payload.message!.clientMessageId)) {
              return prev.map((m) =>
                m.clientMessageId === payload.message!.clientMessageId
                  ? { ...payload.message!, status: 'sent' }
                  : m,
              )
            }
            return [...prev, { ...payload.message!, status: 'sent' }]
          })
        }
        if (event.type === 'session_ended') {
          const payload = event.payload as { sessionId?: string }
          if (payload.sessionId && sessionRef.current?.id === payload.sessionId) {
            void api<HumanSession>(`/api/companion/sessions/${payload.sessionId}`).then(
              (session) => {
                setHumanSession(session)
                void loadSessionMessages(session.id)
              },
            )
          }
        }
      })
    },
    [loadSessionMessages, refreshIncoming, refreshPool],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const st = await fetchCompanionStatus()
      if (cancelled) return
      setStatus(st)
      const stored = loadStoredProfile()
      if (stored && st.available) {
        setProfile(stored)
        attachSocket(stored.token)
        try {
          await refreshPool()
          await refreshIncoming()
        } catch {
          /* token may be stale after server restart */
        }
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [attachSocket, refreshIncoming, refreshPool])

  // Lightweight poll as reconnect safety net.
  useEffect(() => {
    if (!profile) return
    const timer = window.setInterval(() => {
      void refreshPool()
      void refreshIncoming()
      if (sessionRef.current?.id && sessionRef.current.status === 'active') {
        void loadSessionMessages(sessionRef.current.id)
      }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [loadSessionMessages, profile, refreshIncoming, refreshPool])

  const bootstrapGuest = useCallback(
    async (input: { nickname?: string; adultAcknowledged: boolean }) => {
      setError(null)
      const next = await ensureGuestProfile(input)
      setProfile(next)
      attachSocket(next.token)
      await refreshPool()
      await refreshIncoming()
    },
    [attachSocket, refreshIncoming, refreshPool],
  )

  const openRequest = useCallback(async (topicTag: string) => {
    setError(null)
    const req = await api<PoolRequest>('/api/companion/requests', {
      method: 'POST',
      body: JSON.stringify({ topicTag }),
    })
    setMyOpenRequestId(req.id)
    await refreshPool()
    return req
  }, [refreshPool])

  const cancelMyRequest = useCallback(async () => {
    if (!myOpenRequestId) return
    await api(`/api/companion/requests/${myOpenRequestId}/cancel`, { method: 'POST' })
    setMyOpenRequestId(null)
    await refreshPool()
  }, [myOpenRequestId, refreshPool])

  const applyToRequest = useCallback(async (requestId: string) => {
    setError(null)
    await api(`/api/companion/requests/${requestId}/apply`, { method: 'POST' })
    await refreshPool()
  }, [refreshPool])

  const acceptApplication = useCallback(async (applicationId: string) => {
    setError(null)
    const session = await api<HumanSession>(
      `/api/companion/applications/${applicationId}/accept`,
      { method: 'POST' },
    )
    setHumanSession(session)
    setMyOpenRequestId(null)
    setIncoming([])
    await loadSessionMessages(session.id)
  }, [loadSessionMessages])

  const rejectApplication = useCallback(async (applicationId: string) => {
    await api(`/api/companion/applications/${applicationId}/reject`, { method: 'POST' })
    await refreshIncoming()
  }, [refreshIncoming])

  const sendHumanMessage = useCallback(async (content: string) => {
    const session = sessionRef.current
    if (!session || session.status !== 'active') throw new Error('当前没有进行中的真人会话。')
    const clientMessageId = createClientMessageId()
    const optimistic: HumanMessage = {
      id: clientMessageId,
      sessionId: session.id,
      senderId: profile?.userId || 'me',
      senderRole: session.role,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      clientMessageId,
      status: 'sending',
    }
    setHumanMessages((prev) => [...prev, optimistic])
    try {
      const saved = await api<HumanMessage>(`/api/companion/sessions/${session.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, clientMessageId }),
      })
      setHumanMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...saved, status: 'sent' } : m,
        ),
      )
    } catch (err) {
      setHumanMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m,
        ),
      )
      throw err
    }
  }, [profile?.userId])

  const retryHumanMessage = useCallback(async (clientMessageId: string) => {
    const failed = humanMessages.find((m) => m.clientMessageId === clientMessageId)
    if (!failed || !sessionRef.current) return
    setHumanMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId))
    await sendHumanMessage(failed.content)
  }, [humanMessages, sendHumanMessage])

  const endHumanSession = useCallback(async () => {
    if (!sessionRef.current) return
    const session = await api<HumanSession>(
      `/api/companion/sessions/${sessionRef.current.id}/end`,
      { method: 'POST' },
    )
    setHumanSession(session)
    await loadSessionMessages(session.id)
  }, [loadSessionMessages])

  const report = useCallback(async (reason: string, detail?: string) => {
    const session = sessionRef.current
    await api('/api/companion/safety/report', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session?.id,
        targetUserId:
          session && profile
            ? session.requesterId === profile.userId
              ? session.responderId
              : session.requesterId
            : undefined,
        reason,
        detail,
      }),
    })
  }, [profile])

  const blockPeer = useCallback(async () => {
    const session = sessionRef.current
    if (!session || !profile) return
    const targetUserId =
      session.requesterId === profile.userId ? session.responderId : session.requesterId
    await api('/api/companion/safety/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, sessionId: session.id }),
    })
    await endHumanSession()
  }, [endHumanSession, profile])

  const fetchAiTip = useCallback(async () => {
    const data = await api<{ tip: string }>('/api/companion/ai-tip')
    return data.tip
  }, [])

  const submitFeedback = useCallback(async (feedback: string, role: string) => {
    if (!sessionRef.current) return
    await api('/api/companion/feedback', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: sessionRef.current.id,
        feedback,
        role,
      }),
    })
  }, [])

  const clearHumanRound = useCallback(() => {
    setHumanSession(null)
    setHumanMessages([])
    setMyOpenRequestId(null)
    setIncoming([])
    setError(null)
    sessionRef.current = null
  }, [])

  const value = useMemo<CompanionContextValue>(
    () => ({
      status,
      profile,
      ready,
      error,
      pool,
      incoming,
      humanSession,
      humanMessages,
      myOpenRequestId,
      bootstrapGuest,
      refreshPool,
      refreshIncoming,
      openRequest,
      cancelMyRequest,
      applyToRequest,
      acceptApplication,
      rejectApplication,
      sendHumanMessage,
      retryHumanMessage,
      endHumanSession,
      report,
      blockPeer,
      fetchAiTip,
      submitFeedback,
      clearHumanRound,
      clearError: () => setError(null),
    }),
    [
      status,
      profile,
      ready,
      error,
      pool,
      incoming,
      humanSession,
      humanMessages,
      myOpenRequestId,
      bootstrapGuest,
      refreshPool,
      refreshIncoming,
      openRequest,
      cancelMyRequest,
      applyToRequest,
      acceptApplication,
      rejectApplication,
      sendHumanMessage,
      retryHumanMessage,
      endHumanSession,
      report,
      blockPeer,
      fetchAiTip,
      submitFeedback,
      clearHumanRound,
    ],
  )

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>
}

export function useCompanion() {
  const ctx = useContext(CompanionContext)
  if (!ctx) throw new Error('useCompanion must be used within CompanionProvider')
  return ctx
}
