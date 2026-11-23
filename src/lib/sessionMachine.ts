import type { SessionStatus } from '../types'

export type SessionEvent =
  | { type: 'START_AI' }
  | { type: 'OPEN_INVITE_CONFIRM' }
  | { type: 'CANCEL_INVITE_CONFIRM' }
  | { type: 'CONFIRM_OPEN_REQUEST' }
  | { type: 'CANCEL_WAITING' }
  | { type: 'HUMAN_APPLIES' }
  | { type: 'CONFIRM_HUMAN_JOIN' }
  | { type: 'REJECT_HUMAN_JOIN' }
  | { type: 'HUMAN_LEAVES' }
  | { type: 'END_SESSION' }
  | { type: 'EXPIRE_REQUEST' }

const transitions: Record<SessionStatus, Partial<Record<SessionEvent['type'], SessionStatus>>> = {
  ai_chatting: {
    OPEN_INVITE_CONFIRM: 'invite_confirming',
    END_SESSION: 'ended',
  },
  invite_confirming: {
    CANCEL_INVITE_CONFIRM: 'ai_chatting',
    CONFIRM_OPEN_REQUEST: 'waiting_human',
    END_SESSION: 'ended',
  },
  waiting_human: {
    CANCEL_WAITING: 'ai_chatting',
    HUMAN_APPLIES: 'human_requesting',
    EXPIRE_REQUEST: 'ai_chatting',
    END_SESSION: 'ended',
  },
  human_requesting: {
    CONFIRM_HUMAN_JOIN: 'human_joined',
    REJECT_HUMAN_JOIN: 'waiting_human',
    CANCEL_WAITING: 'ai_chatting',
    END_SESSION: 'ended',
  },
  human_joined: {
    HUMAN_LEAVES: 'human_left',
    END_SESSION: 'ended',
  },
  human_left: {
    END_SESSION: 'ended',
    OPEN_INVITE_CONFIRM: 'invite_confirming',
  },
  ended: {},
}

export function canTransition(status: SessionStatus, event: SessionEvent['type']): boolean {
  return Boolean(transitions[status][event])
}

export function transitionSession(
  status: SessionStatus,
  event: SessionEvent,
): SessionStatus {
  const next = transitions[status][event.type]
  if (!next) {
    throw new Error(`Invalid transition: ${status} + ${event.type}`)
  }
  return next
}

export function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'ai_chatting':
      return 'AI 陪伴中'
    case 'invite_confirming':
      return '确认是否邀请真人'
    case 'waiting_human':
      return '等待真人响应'
    case 'human_requesting':
      return '有人申请加入'
    case 'human_joined':
      return '真人已加入'
    case 'human_left':
      return '真人已退出'
    case 'ended':
      return '会话已结束'
  }
}

export function isActiveSession(status: SessionStatus): boolean {
  return status !== 'ended'
}
