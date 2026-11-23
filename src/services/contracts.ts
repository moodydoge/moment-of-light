import type {
  BlockAction,
  ChatMessage,
  CompanionRequest,
  CompanionSession,
  ReportAction,
  SessionFeedback,
  TopicCard,
} from '../types'

export interface AiReplyInput {
  sessionId: string
  userMessage: string
  topicIds: string[]
  /** Prior turns for continuity; keep short to limit cost. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  signal?: AbortSignal
}

export interface CompanionAIService {
  readonly kind: 'demo' | 'live'
  getTopicCards(): Promise<TopicCard[]>
  reply(input: AiReplyInput): Promise<ChatMessage>
}

export interface MatchingService {
  readonly kind: 'demo' | 'live'
  openRequest(input: {
    session: CompanionSession
    topicLabels: string[]
  }): Promise<CompanionRequest>
  listOpenRequests(): Promise<CompanionRequest[]>
  cancelRequest(requestId: string): Promise<void>
  applyToJoin(requestId: string): Promise<{ pendingConfirm: boolean }>
  confirmJoin(sessionId: string): Promise<void>
  rejectJoin(sessionId: string): Promise<void>
}

export interface ChatService {
  readonly kind: 'demo' | 'live'
  listMessages(sessionId: string): Promise<ChatMessage[]>
  sendUserMessage(input: {
    sessionId: string
    content: string
  }): Promise<ChatMessage>
  appendMessage(message: ChatMessage): Promise<ChatMessage>
  /** Simulate send failure for demo / testing. */
  setFailNextSend?(fail: boolean): void
}

export interface FeedbackService {
  readonly kind: 'demo' | 'live'
  submit(feedback: Omit<SessionFeedback, 'createdAt' | 'verifiedOutcome'>): Promise<SessionFeedback>
  report(action: Omit<ReportAction, 'id' | 'createdAt'>): Promise<ReportAction>
  block(action: Omit<BlockAction, 'id' | 'createdAt'>): Promise<BlockAction>
}

export interface AiStatus {
  configured: boolean
  kind: 'live' | 'unavailable'
  model: string | null
  baseUrlHost?: string
}

export interface AppServices {
  ai: CompanionAIService
  matching: MatchingService
  chat: ChatService
  feedback: FeedbackService
  aiStatus: AiStatus
}
