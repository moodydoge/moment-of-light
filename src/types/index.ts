/** Core domain types for 此刻有光 (moment-of-light). */

export type UserRole = 'initiator' | 'responder' | 'guest'

export type SessionMode = 'ai_only' | 'human_invited' | 'human_joined'

export type SessionStatus =
  | 'ai_chatting'
  | 'invite_confirming'
  | 'waiting_human'
  | 'human_requesting'
  | 'human_joined'
  | 'human_left'
  | 'ended'

export type MatchStatus =
  | 'open'
  | 'pending_confirm'
  | 'matched'
  | 'cancelled'
  | 'expired'
  | 'closed'

export type MessageSender = 'user' | 'ai' | 'human' | 'system'

export interface TopicCard {
  id: string
  label: string
  prompt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  sender: MessageSender
  /** Display label required for identity clarity (e.g. "AI 陪伴", "你", "真人参与者"). */
  senderLabel: string
  content: string
  createdAt: string
  /** Demo replies must be marked; never disguise as real model output. */
  isDemo?: boolean
  status?: 'sending' | 'sent' | 'failed'
}

export interface CompanionSession {
  id: string
  role: UserRole
  mode: SessionMode
  status: SessionStatus
  topicIds: string[]
  moodNote?: string
  shareAiHistory: boolean
  createdAt: string
  updatedAt: string
  demo: boolean
  humanJoinedAt?: string
  endedAt?: string
}

export interface CompanionRequest {
  id: string
  sessionId: string
  anonymousLabel: string
  topicLabels: string[]
  createdAt: string
  status: MatchStatus
  demo: boolean
  /** Never include contact info, precise location, or free-text private notes in public pool. */
}

export interface SessionFeedback {
  sessionId: string
  role: UserRole
  choice:
    | 'felt_better'
    | 'not_helpful'
    | 'completed_companionship'
    | 'skipped'
  note?: string
  createdAt: string
  /** Subjective expression only — not verified psychological outcome. */
  verifiedOutcome: false
}

export type ReportReason =
  | 'harassment'
  | 'inappropriate'
  | 'crisis_concern'
  | 'spam'
  | 'other'

export interface ReportAction {
  id: string
  sessionId: string
  target: 'human_participant' | 'request' | 'message'
  reason: ReportReason
  detail?: string
  createdAt: string
  demo: boolean
}

export interface BlockAction {
  id: string
  sessionId: string
  createdAt: string
  demo: boolean
}

export interface SafetyBoundary {
  canExitAnytime: true
  dualConsentRequired: true
  defaultShareAiHistory: false
  showContactInPool: false
  aiNeverPretendHuman: true
  noFakePresence: true
  notProfessionalCounseling: true
}
