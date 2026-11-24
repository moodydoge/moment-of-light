import { afterEach, describe, expect, it } from 'vitest'
import { inviteCodeRequired, issueGuestToken } from './auth'

describe('guest invite gate', () => {
  const prevInvite = process.env.MOL_COMPANION_INVITE_CODE
  const prevSecret = process.env.MOL_COMPANION_SECRET

  afterEach(() => {
    if (prevInvite === undefined) delete process.env.MOL_COMPANION_INVITE_CODE
    else process.env.MOL_COMPANION_INVITE_CODE = prevInvite
    if (prevSecret === undefined) delete process.env.MOL_COMPANION_SECRET
    else process.env.MOL_COMPANION_SECRET = prevSecret
  })

  it('allows guest when invite env unset', () => {
    delete process.env.MOL_COMPANION_INVITE_CODE
    process.env.MOL_COMPANION_SECRET = 'test-secret'
    expect(inviteCodeRequired()).toBe(false)
    const issued = issueGuestToken({ adultAcknowledged: true, nickname: '灯' })
    expect(issued.identity.userId).toMatch(/^u_/)
  })

  it('rejects wrong or missing invite when configured', () => {
    process.env.MOL_COMPANION_INVITE_CODE = 'trial-only'
    process.env.MOL_COMPANION_SECRET = 'test-secret'
    expect(inviteCodeRequired()).toBe(true)
    expect(() =>
      issueGuestToken({ adultAcknowledged: true, inviteCode: 'wrong' }),
    ).toThrow(/邀请码/)
    const ok = issueGuestToken({
      adultAcknowledged: true,
      inviteCode: 'trial-only',
      nickname: '受邀',
    })
    expect(ok.identity.nickname).toContain('受邀')
  })
})
