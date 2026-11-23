import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GuestIdentity } from './auth'
import { resetDbForTests } from './db'
import { CompanionStore } from './store'

function guest(id: string, nick: string): GuestIdentity {
  return {
    userId: id,
    nickname: nick,
    adultAcknowledged: true,
    iat: Date.now(),
    exp: Date.now() + 60_000,
  }
}

describe('CompanionStore matching', () => {
  let file: string
  let store: CompanionStore

  beforeEach(() => {
    file = path.join(os.tmpdir(), `mol-companion-${Date.now()}-${Math.random()}.sqlite`)
    resetDbForTests(file)
    store = new CompanionStore()
  })

  afterEach(() => {
    try {
      fs.unlinkSync(file)
    } catch {
      /* ignore */
    }
  })

  it('opens request and lists for other users only', () => {
    const owner = guest('u_owner', '发起者')
    const viewer = guest('u_viewer', '路人')
    store.openRequest(owner, '随便聊聊')
    expect(store.listOpenRequests(owner.userId)).toHaveLength(0)
    expect(store.listOpenRequests(viewer.userId)).toHaveLength(1)
  })

  it('accepts only one application atomically', () => {
    const owner = guest('u_owner', '发起者')
    const a = guest('u_a', '响应A')
    const b = guest('u_b', '响应B')
    const req = store.openRequest(owner, '一件小事')
    const appA = store.applyToRequest(a, req.id)
    // second apply while pending_confirm should still create application row,
    // but only one can take the seat.
    const appB = store.applyToRequest(b, req.id)

    const session = store.acceptApplication(owner, appA.applicationId)
    expect(session.status).toBe('active')
    expect(session.responderId).toBe(a.userId)

    expect(() => store.acceptApplication(owner, appB.applicationId)).toThrow(/席位|状态/)
  })

  it('rejects stranger access to session messages', () => {
    const owner = guest('u_owner', '发起者')
    const responder = guest('u_res', '响应者')
    const stranger = guest('u_x', '外人')
    const req = store.openRequest(owner, '话题')
    const app = store.applyToRequest(responder, req.id)
    const session = store.acceptApplication(owner, app.applicationId)
    expect(() => store.listMessages(session.id, stranger.userId)).toThrow(/无权/)
  })

  it('dedupes messages by clientMessageId and blocks ended sends', () => {
    const owner = guest('u_owner', '发起者')
    const responder = guest('u_res', '响应者')
    const req = store.openRequest(owner, '话题')
    const app = store.applyToRequest(responder, req.id)
    const session = store.acceptApplication(owner, app.applicationId)

    const first = store.sendMessage(owner, {
      sessionId: session.id,
      content: '你好',
      clientMessageId: 'c1',
    })
    const second = store.sendMessage(owner, {
      sessionId: session.id,
      content: '你好',
      clientMessageId: 'c1',
    })
    expect(second.id).toBe(first.id)

    store.endSession(owner, session.id)
    expect(() =>
      store.sendMessage(owner, {
        sessionId: session.id,
        content: '还能发吗',
        clientMessageId: 'c2',
      }),
    ).toThrow(/结束/)
  })

  it('enforces block relationship on apply', () => {
    const owner = guest('u_owner', '发起者')
    const responder = guest('u_res', '响应者')
    const req = store.openRequest(owner, '话题')
    store.block(owner, responder.userId)
    expect(() => store.applyToRequest(responder, req.id)).toThrow(/无法申请/)
  })
})
