import { describe, expect, it } from 'vitest'
import {
  canTransition,
  statusLabel,
  transitionSession,
} from './sessionMachine'

describe('sessionMachine', () => {
  it('starts AI chat and allows invite confirm flow', () => {
    expect(canTransition('ai_chatting', 'OPEN_INVITE_CONFIRM')).toBe(true)
    expect(transitionSession('ai_chatting', { type: 'OPEN_INVITE_CONFIRM' })).toBe(
      'invite_confirming',
    )
    expect(
      transitionSession('invite_confirming', { type: 'CONFIRM_OPEN_REQUEST' }),
    ).toBe('waiting_human')
  })

  it('requires confirm before human joins', () => {
    expect(transitionSession('waiting_human', { type: 'HUMAN_APPLIES' })).toBe(
      'human_requesting',
    )
    expect(
      transitionSession('human_requesting', { type: 'CONFIRM_HUMAN_JOIN' }),
    ).toBe('human_joined')
  })

  it('supports cancel, reject, leave, expire, and end', () => {
    expect(transitionSession('invite_confirming', { type: 'CANCEL_INVITE_CONFIRM' })).toBe(
      'ai_chatting',
    )
    expect(transitionSession('waiting_human', { type: 'CANCEL_WAITING' })).toBe('ai_chatting')
    expect(transitionSession('human_requesting', { type: 'REJECT_HUMAN_JOIN' })).toBe(
      'waiting_human',
    )
    expect(transitionSession('waiting_human', { type: 'EXPIRE_REQUEST' })).toBe('ai_chatting')
    expect(transitionSession('human_joined', { type: 'HUMAN_LEAVES' })).toBe('human_left')
    expect(transitionSession('human_left', { type: 'END_SESSION' })).toBe('ended')
  })

  it('rejects invalid transitions', () => {
    expect(canTransition('ended', 'OPEN_INVITE_CONFIRM')).toBe(false)
    expect(() =>
      transitionSession('ended', { type: 'OPEN_INVITE_CONFIRM' }),
    ).toThrow(/Invalid transition/)
  })

  it('provides readable Chinese status labels', () => {
    expect(statusLabel('waiting_human')).toBe('等待真人响应')
    expect(statusLabel('human_joined')).toBe('真人已加入')
  })
})
