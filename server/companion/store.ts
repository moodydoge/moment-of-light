import { randomBytes } from 'node:crypto'
import type { GuestIdentity } from './auth'
import { getDb } from './db'

const REQUEST_TTL_MS = 10 * 60_000
const MAX_MSG_LEN = 500
const MIN_SEND_INTERVAL_MS = 800

export type RequestStatus =
  | 'open'
  | 'pending_confirm'
  | 'matched'
  | 'cancelled'
  | 'expired'
  | 'closed'

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'
export type HumanSessionStatus = 'active' | 'ended'

function id(prefix: string) {
  return `${prefix}_${randomBytes(6).toString('hex')}`
}

function nowIso() {
  return new Date().toISOString()
}

export class CompanionStore {
  private lastSend = new Map<string, number>()

  ensureUser(identity: GuestIdentity) {
    const db = getDb()
    db.prepare(
      `INSERT INTO users (id, nickname, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname`,
    ).run(identity.userId, identity.nickname, nowIso())
  }

  expireDueRequests() {
    const db = getDb()
    const now = nowIso()
    db.prepare(
      `UPDATE companion_requests
       SET status = 'expired'
       WHERE status IN ('open', 'pending_confirm')
         AND expires_at < ?`,
    ).run(now)
    db.prepare(
      `UPDATE companion_applications
       SET status = 'withdrawn'
       WHERE status = 'pending'
         AND request_id IN (
           SELECT id FROM companion_requests WHERE status = 'expired'
         )`,
    ).run()
  }

  isBlocked(a: string, b: string) {
    const db = getDb()
    const row = db
      .prepare(
        `SELECT 1 AS ok FROM blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)`,
      )
      .get(a, b, b, a) as { ok: number } | undefined
    return Boolean(row)
  }

  openRequest(identity: GuestIdentity, topicTag: string) {
    this.ensureUser(identity)
    this.expireDueRequests()
    const tag = topicTag.trim().slice(0, 40) || '轻量陪伴'
    const db = getDb()
    // Cancel previous open requests from same owner.
    db.prepare(
      `UPDATE companion_requests
       SET status = 'cancelled'
       WHERE owner_id = ? AND status IN ('open', 'pending_confirm')`,
    ).run(identity.userId)

    const createdAt = Date.now()
    const row = {
      id: id('req'),
      owner_id: identity.userId,
      topic_tag: tag,
      visibility: 'pool',
      status: 'open' as RequestStatus,
      created_at: new Date(createdAt).toISOString(),
      expires_at: new Date(createdAt + REQUEST_TTL_MS).toISOString(),
    }
    db.prepare(
      `INSERT INTO companion_requests
       (id, owner_id, topic_tag, visibility, status, created_at, expires_at)
       VALUES (@id, @owner_id, @topic_tag, @visibility, @status, @created_at, @expires_at)`,
    ).run(row)
    return this.getPublicRequest(row.id)!
  }

  cancelRequest(identity: GuestIdentity, requestId: string) {
    const db = getDb()
    const result = db
      .prepare(
        `UPDATE companion_requests
         SET status = 'cancelled'
         WHERE id = ? AND owner_id = ? AND status IN ('open', 'pending_confirm')`,
      )
      .run(requestId, identity.userId)
    if (result.changes === 0) throw new Error('无法取消该请求（不存在、无权限或状态已变更）。')
    db.prepare(
      `UPDATE companion_applications SET status = 'withdrawn'
       WHERE request_id = ? AND status = 'pending'`,
    ).run(requestId)
  }

  listOpenRequests(viewerId: string) {
    this.expireDueRequests()
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT r.*
         FROM companion_requests r
         WHERE r.status = 'open'
           AND r.expires_at >= ?
           AND r.owner_id != ?
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = r.owner_id)
                OR (b.blocker_id = r.owner_id AND b.blocked_id = ?)
           )
         ORDER BY r.created_at DESC
         LIMIT 50`,
      )
      .all(nowIso(), viewerId, viewerId, viewerId) as Array<Record<string, unknown>>
    return rows.map((r) => this.toPublicRequest(r))
  }

  applyToRequest(identity: GuestIdentity, requestId: string) {
    this.ensureUser(identity)
    this.expireDueRequests()
    const ownerId = this.ownerOf(requestId)
    if (!ownerId) throw new Error('请求不存在。')
    if (this.isBlocked(identity.userId, ownerId)) {
      throw new Error('当前无法申请该请求。')
    }
    const db = getDb()
    const req = db
      .prepare(`SELECT * FROM companion_requests WHERE id = ?`)
      .get(requestId) as Record<string, unknown> | undefined
    if (!req) throw new Error('请求不存在。')
    if (req.owner_id === identity.userId) throw new Error('不能响应自己的请求。')
    if (req.status !== 'open' && req.status !== 'pending_confirm') {
      throw new Error('该请求当前不可申请。')
    }

    const active = db
      .prepare(
        `SELECT id FROM companion_sessions
         WHERE status = 'active' AND (requester_id = ? OR responder_id = ?)`,
      )
      .get(identity.userId, identity.userId)
    if (active) throw new Error('你已有进行中的真人会话，请先结束后再申请。')

    const appId = id('app')
    try {
      db.prepare(
        `INSERT INTO companion_applications (id, request_id, responder_id, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
      ).run(appId, requestId, identity.userId, nowIso())
    } catch {
      throw new Error('你已申请过该请求。')
    }

    db.prepare(
      `UPDATE companion_requests SET status = 'pending_confirm'
       WHERE id = ? AND status IN ('open', 'pending_confirm')`,
    ).run(requestId)

    return {
      applicationId: appId,
      requestId,
      status: 'pending' as const,
      pendingConfirm: true,
    }
  }

  listPendingApplicationsForOwner(ownerId: string) {
    this.expireDueRequests()
    const db = getDb()
    return db
      .prepare(
        `SELECT a.id as applicationId, a.request_id as requestId, a.responder_id as responderId,
                a.status, a.created_at as createdAt, u.nickname as responderNickname,
                r.topic_tag as topicTag
         FROM companion_applications a
         JOIN companion_requests r ON r.id = a.request_id
         JOIN users u ON u.id = a.responder_id
         WHERE r.owner_id = ? AND a.status = 'pending' AND r.status = 'pending_confirm'
         ORDER BY a.created_at ASC`,
      )
      .all(ownerId)
  }

  /**
   * Atomic accept: only one pending application can become the matched seat.
   */
  acceptApplication(owner: GuestIdentity, applicationId: string) {
    this.expireDueRequests()
    const db = getDb()
    const app = db
      .prepare(
        `SELECT a.*, r.owner_id, r.status as request_status
         FROM companion_applications a
         JOIN companion_requests r ON r.id = a.request_id
         WHERE a.id = ?`,
      )
      .get(applicationId) as Record<string, unknown> | undefined
    if (!app) throw new Error('申请不存在。')
    if (app.owner_id !== owner.userId) throw new Error('无权处理该申请。')
    if (app.status !== 'pending') throw new Error('申请状态不可接受。')
    if (app.request_status !== 'pending_confirm' && app.request_status !== 'open') {
      throw new Error('请求状态不可接受。')
    }
    if (this.isBlocked(owner.userId, String(app.responder_id))) {
      throw new Error('双方存在阻止关系，无法匹配。')
    }

    const sessionId = id('hsess')
    const startedAt = nowIso()
    const responderId = String(app.responder_id)
    const requestId = String(app.request_id)

    const tx = db.prepare('BEGIN IMMEDIATE')
    const commit = db.prepare('COMMIT')
    const rollback = db.prepare('ROLLBACK')
    tx.run()
    try {
      const seat = db
        .prepare(
          `UPDATE companion_requests
           SET status = 'matched',
               matched_participant_id = ?,
               human_session_id = ?
           WHERE id = ?
             AND status IN ('open', 'pending_confirm')
             AND matched_participant_id IS NULL`,
        )
        .run(responderId, sessionId, requestId)
      if (seat.changes !== 1) {
        throw new Error('该请求席位已被占用或状态已变更。')
      }

      const accepted = db
        .prepare(
          `UPDATE companion_applications
           SET status = 'accepted'
           WHERE id = ? AND status = 'pending'`,
        )
        .run(applicationId)
      if (accepted.changes !== 1) throw new Error('申请已被处理。')

      db.prepare(
        `UPDATE companion_applications
         SET status = 'rejected'
         WHERE request_id = ? AND id != ? AND status = 'pending'`,
      ).run(requestId, applicationId)

      db.prepare(
        `INSERT INTO companion_sessions
         (id, request_id, requester_id, responder_id, status, started_at)
         VALUES (?, ?, ?, ?, 'active', ?)`,
      ).run(sessionId, requestId, owner.userId, responderId, startedAt)

      db.prepare(
        `INSERT INTO chat_messages
         (id, session_id, sender_id, sender_role, content, created_at, client_message_id)
         VALUES (?, ?, 'system', 'system', ?, ?, ?)`,
      ).run(
        id('msg'),
        sessionId,
        '双方已确认。请保持尊重，随时可以结束。这不是专业心理支持。（受控试点）',
        startedAt,
        `sys_${sessionId}`,
      )
      commit.run()
    } catch (err) {
      rollback.run()
      throw err
    }

    return this.getSessionForUser(sessionId, owner.userId)
  }

  rejectApplication(owner: GuestIdentity, applicationId: string) {
    const db = getDb()
    const app = db
      .prepare(
        `SELECT a.*, r.owner_id, r.id as request_id
         FROM companion_applications a
         JOIN companion_requests r ON r.id = a.request_id
         WHERE a.id = ?`,
      )
      .get(applicationId) as Record<string, unknown> | undefined
    if (!app) throw new Error('申请不存在。')
    if (app.owner_id !== owner.userId) throw new Error('无权处理该申请。')
    const result = db
      .prepare(
        `UPDATE companion_applications SET status = 'rejected'
         WHERE id = ? AND status = 'pending'`,
      )
      .run(applicationId)
    if (result.changes === 0) throw new Error('申请状态不可拒绝。')

    const requestId = String(app.request_id)
    const pending = db
      .prepare(
        `SELECT COUNT(*) as c FROM companion_applications
         WHERE request_id = ? AND status = 'pending'`,
      )
      .get(requestId) as { c: number }
    if (pending.c === 0) {
      db.prepare(
        `UPDATE companion_requests SET status = 'open'
         WHERE id = ? AND status = 'pending_confirm' AND matched_participant_id IS NULL`,
      ).run(requestId)
    }
  }

  getSessionForUser(sessionId: string, userId: string) {
    const db = getDb()
    const row = db
      .prepare(`SELECT * FROM companion_sessions WHERE id = ?`)
      .get(sessionId) as Record<string, unknown> | undefined
    if (!row) throw new Error('会话不存在。')
    if (row.requester_id !== userId && row.responder_id !== userId) {
      throw new Error('无权访问该会话。')
    }
    const peerId =
      row.requester_id === userId ? String(row.responder_id) : String(row.requester_id)
    const peer = db.prepare(`SELECT nickname FROM users WHERE id = ?`).get(peerId) as
      | { nickname: string }
      | undefined
    return {
      id: String(row.id),
      requestId: String(row.request_id),
      requesterId: String(row.requester_id),
      responderId: String(row.responder_id),
      status: String(row.status) as HumanSessionStatus,
      startedAt: String(row.started_at),
      endedAt: row.ended_at ? String(row.ended_at) : null,
      endReason: row.end_reason ? String(row.end_reason) : null,
      role: row.requester_id === userId ? ('requester' as const) : ('responder' as const),
      peerNickname: peer?.nickname || '真人参与者',
      kind: 'live-controlled' as const,
    }
  }

  listMessages(sessionId: string, userId: string) {
    this.getSessionForUser(sessionId, userId)
    const db = getDb()
    return db
      .prepare(
        `SELECT id, session_id as sessionId, sender_id as senderId, sender_role as senderRole,
                content, created_at as createdAt, client_message_id as clientMessageId
         FROM chat_messages
         WHERE session_id = ?
         ORDER BY created_at ASC
         LIMIT 200`,
      )
      .all(sessionId)
  }

  sendMessage(
    identity: GuestIdentity,
    input: { sessionId: string; content: string; clientMessageId: string },
  ) {
    const session = this.getSessionForUser(input.sessionId, identity.userId)
    if (session.status !== 'active') throw new Error('会话已结束，无法发送。')
    const content = input.content.trim()
    if (!content) throw new Error('消息不能为空。')
    if (content.length > MAX_MSG_LEN) throw new Error(`消息请控制在 ${MAX_MSG_LEN} 字以内。`)
    const clientMessageId = input.clientMessageId.trim().slice(0, 64)
    if (!clientMessageId) throw new Error('缺少 clientMessageId。')

    const db = getDb()
    const existing = db
      .prepare(
        `SELECT id, session_id as sessionId, sender_id as senderId, sender_role as senderRole,
                content, created_at as createdAt, client_message_id as clientMessageId
         FROM chat_messages WHERE session_id = ? AND client_message_id = ?`,
      )
      .get(input.sessionId, clientMessageId)
    if (existing) return existing

    const key = `${identity.userId}:${input.sessionId}`
    const last = this.lastSend.get(key) || 0
    const now = Date.now()
    if (now - last < MIN_SEND_INTERVAL_MS) throw new Error('发送过于频繁，请稍候。')
    this.lastSend.set(key, now)

    const role = session.role === 'requester' ? 'requester' : 'responder'
    const msg = {
      id: id('msg'),
      sessionId: input.sessionId,
      senderId: identity.userId,
      senderRole: role,
      content,
      createdAt: nowIso(),
      clientMessageId,
    }
    db.prepare(
      `INSERT INTO chat_messages
       (id, session_id, sender_id, sender_role, content, created_at, client_message_id)
       VALUES (@id, @sessionId, @senderId, @senderRole, @content, @createdAt, @clientMessageId)`,
    ).run(msg)
    return msg
  }

  endSession(identity: GuestIdentity, sessionId: string, reason = 'user_end') {
    const session = this.getSessionForUser(sessionId, identity.userId)
    if (session.status === 'ended') return session
    const db = getDb()
    const endedAt = nowIso()
    db.prepare(
      `UPDATE companion_sessions
       SET status = 'ended', ended_at = ?, end_reason = ?
       WHERE id = ? AND status = 'active'`,
    ).run(endedAt, reason, sessionId)
    db.prepare(
      `UPDATE companion_requests SET status = 'closed'
       WHERE human_session_id = ?`,
    ).run(sessionId)
    db.prepare(
      `INSERT INTO chat_messages
       (id, session_id, sender_id, sender_role, content, created_at, client_message_id)
       VALUES (?, ?, 'system', 'system', ?, ?, ?)`,
    ).run(
      id('msg'),
      sessionId,
      '会话已结束。双方可前往反馈页；这不是经过验证的心理改善。',
      endedAt,
      `end_${sessionId}_${endedAt}`,
    )
    return this.getSessionForUser(sessionId, identity.userId)
  }

  report(
    identity: GuestIdentity,
    input: { sessionId?: string; targetUserId?: string; reason: string; detail?: string },
  ) {
    const db = getDb()
    const row = {
      id: id('rpt'),
      actor_id: identity.userId,
      target_user_id: input.targetUserId || null,
      session_id: input.sessionId || null,
      type: 'report',
      reason: `${input.reason}${input.detail ? `: ${input.detail.slice(0, 200)}` : ''}`.slice(
        0,
        300,
      ),
      created_at: nowIso(),
    }
    db.prepare(
      `INSERT INTO safety_actions
       (id, actor_id, target_user_id, session_id, type, reason, created_at)
       VALUES (@id, @actor_id, @target_user_id, @session_id, @type, @reason, @created_at)`,
    ).run(row)
    return { id: row.id, createdAt: row.created_at }
  }

  block(identity: GuestIdentity, targetUserId: string, sessionId?: string) {
    if (!targetUserId || targetUserId === identity.userId) {
      throw new Error('无效的阻止对象。')
    }
    const db = getDb()
    db.prepare(
      `INSERT INTO blocks (blocker_id, blocked_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(blocker_id, blocked_id) DO NOTHING`,
    ).run(identity.userId, targetUserId, nowIso())
    db.prepare(
      `INSERT INTO safety_actions
       (id, actor_id, target_user_id, session_id, type, reason, created_at)
       VALUES (?, ?, ?, ?, 'block', 'user_block', ?)`,
    ).run(id('blk'), identity.userId, targetUserId, sessionId || null, nowIso())
    if (sessionId) {
      try {
        this.endSession(identity, sessionId, 'blocked')
      } catch {
        /* session may already be ended */
      }
    }
    return { ok: true as const }
  }

  submitFeedback(
    identity: GuestIdentity,
    input: { sessionId: string; role: string; feedback: string },
  ) {
    this.getSessionForUser(input.sessionId, identity.userId)
    const db = getDb()
    const row = {
      id: id('fb'),
      session_id: input.sessionId,
      author_id: identity.userId,
      role: input.role.slice(0, 32),
      feedback: input.feedback.slice(0, 64),
      created_at: nowIso(),
    }
    db.prepare(
      `INSERT INTO session_feedback
       (id, session_id, author_id, role, feedback, created_at)
       VALUES (@id, @session_id, @author_id, @role, @feedback, @created_at)`,
    ).run(row)
    return { ...row, verifiedOutcome: false as const }
  }

  topicSuggestion() {
    const tips = [
      '最近有没有一件很小、但还算不错的事？',
      '今天有没有注意到什么天气或路边的小细节？',
      '如果只能用三个字形容此刻，你会选什么？',
    ]
    return tips[Math.floor(Math.random() * tips.length)]
  }

  private ownerOf(requestId: string) {
    const row = getDb()
      .prepare(`SELECT owner_id FROM companion_requests WHERE id = ?`)
      .get(requestId) as { owner_id: string } | undefined
    return row?.owner_id
  }

  getPublicRequest(requestId: string) {
    const row = getDb()
      .prepare(`SELECT * FROM companion_requests WHERE id = ?`)
      .get(requestId) as Record<string, unknown> | undefined
    return row ? this.toPublicRequest(row) : null
  }

  private toPublicRequest(row: Record<string, unknown>) {
    const ownerId = String(row.owner_id)
    const short = ownerId.slice(-4).toUpperCase()
    return {
      id: String(row.id),
      anonymousLabel: `匿名请求 · ${short}`,
      topicLabels: [String(row.topic_tag)],
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      status: String(row.status) as RequestStatus,
      demo: false,
      kind: 'live-controlled' as const,
      humanSessionId: row.human_session_id ? String(row.human_session_id) : null,
    }
  }
}

export const companionStore = new CompanionStore()
