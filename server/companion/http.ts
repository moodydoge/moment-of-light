import { issueGuestToken, readBearer, verifyGuestToken } from './auth'
import { broadcastAll, broadcastToUsers } from './hub'
import { companionStore } from './store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function requireUser(request: Request) {
  const token = readBearer(request.headers.get('authorization'))
  const identity = verifyGuestToken(token)
  if (!identity) {
    throw Object.assign(new Error('未登录或令牌无效。请先获取访客身份。'), {
      status: 401,
      code: 'UNAUTHORIZED',
    })
  }
  return identity
}

async function readBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

export async function handleCompanionApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    if (request.method === 'GET' && path === '/api/companion/status') {
      return json({
        available: true,
        kind: 'live-controlled',
        publicOpen: false,
        note: '受控试点：服务端签发身份 + SQLite + WebSocket。尚未对公众开放无限制陌生人匹配。',
      })
    }

    if (request.method === 'POST' && path === '/api/companion/auth/guest') {
      const body = await readBody<{ nickname?: string; adultAcknowledged?: boolean }>(request)
      const issued = issueGuestToken({
        nickname: body.nickname,
        adultAcknowledged: Boolean(body.adultAcknowledged),
      })
      companionStore.ensureUser(issued.identity)
      return json({
        token: issued.token,
        userId: issued.identity.userId,
        nickname: issued.identity.nickname,
        kind: 'live-controlled',
        adultNote: '年龄声明不等于严格年龄核验；本受控试点仅面向成年人。',
      })
    }

    if (request.method === 'POST' && path === '/api/companion/requests') {
      const user = requireUser(request)
      const body = await readBody<{ topicTag?: string }>(request)
      const req = companionStore.openRequest(user, body.topicTag || '轻量陪伴')
      broadcastAll({ type: 'request_pool_changed' })
      return json(req)
    }

    if (request.method === 'GET' && path === '/api/companion/requests') {
      const user = requireUser(request)
      return json({ items: companionStore.listOpenRequests(user.userId) })
    }

    if (request.method === 'POST' && path.startsWith('/api/companion/requests/') && path.endsWith('/cancel')) {
      const user = requireUser(request)
      const requestId = path.split('/')[4]
      companionStore.cancelRequest(user, requestId)
      broadcastAll({ type: 'request_pool_changed' })
      return json({ ok: true })
    }

    if (request.method === 'POST' && path.startsWith('/api/companion/requests/') && path.endsWith('/apply')) {
      const user = requireUser(request)
      const requestId = path.split('/')[4]
      const result = companionStore.applyToRequest(user, requestId)
      const publicReq = companionStore.getPublicRequest(requestId)
      // Notify pool + owner via applications poll/ws
      broadcastAll({ type: 'request_pool_changed' })
      if (publicReq) {
        broadcastAll({
          type: 'application_created',
          payload: { requestId, applicationId: result.applicationId },
        })
      }
      return json(result)
    }

    if (request.method === 'GET' && path === '/api/companion/applications/incoming') {
      const user = requireUser(request)
      return json({ items: companionStore.listPendingApplicationsForOwner(user.userId) })
    }

    if (request.method === 'POST' && path.startsWith('/api/companion/applications/') && path.endsWith('/accept')) {
      const user = requireUser(request)
      const applicationId = path.split('/')[4]
      const session = companionStore.acceptApplication(user, applicationId)
      broadcastToUsers([session.requesterId, session.responderId], {
        type: 'session_started',
        payload: { sessionId: session.id },
      })
      broadcastAll({ type: 'request_pool_changed' })
      return json(session)
    }

    if (request.method === 'POST' && path.startsWith('/api/companion/applications/') && path.endsWith('/reject')) {
      const user = requireUser(request)
      const applicationId = path.split('/')[4]
      companionStore.rejectApplication(user, applicationId)
      broadcastAll({ type: 'request_pool_changed' })
      return json({ ok: true })
    }

    if (request.method === 'GET' && path.startsWith('/api/companion/sessions/')) {
      const user = requireUser(request)
      const parts = path.split('/')
      const sessionId = parts[4]
      if (parts[5] === 'messages') {
        return json({ items: companionStore.listMessages(sessionId, user.userId) })
      }
      return json(companionStore.getSessionForUser(sessionId, user.userId))
    }

    if (request.method === 'POST' && path.match(/^\/api\/companion\/sessions\/[^/]+\/messages$/)) {
      const user = requireUser(request)
      const sessionId = path.split('/')[4]
      const body = await readBody<{ content?: string; clientMessageId?: string }>(request)
      const msg = companionStore.sendMessage(user, {
        sessionId,
        content: body.content || '',
        clientMessageId: body.clientMessageId || '',
      })
      const session = companionStore.getSessionForUser(sessionId, user.userId)
      broadcastToUsers([session.requesterId, session.responderId], {
        type: 'message_created',
        payload: { sessionId, message: msg },
      })
      return json(msg)
    }

    if (request.method === 'POST' && path.match(/^\/api\/companion\/sessions\/[^/]+\/end$/)) {
      const user = requireUser(request)
      const sessionId = path.split('/')[4]
      const session = companionStore.endSession(user, sessionId)
      broadcastToUsers([session.requesterId, session.responderId], {
        type: 'session_ended',
        payload: { sessionId },
      })
      return json(session)
    }

    if (request.method === 'POST' && path === '/api/companion/safety/report') {
      const user = requireUser(request)
      const body = await readBody<{
        sessionId?: string
        targetUserId?: string
        reason?: string
        detail?: string
      }>(request)
      return json(
        companionStore.report(user, {
          sessionId: body.sessionId,
          targetUserId: body.targetUserId,
          reason: body.reason || 'other',
          detail: body.detail,
        }),
      )
    }

    if (request.method === 'POST' && path === '/api/companion/safety/block') {
      const user = requireUser(request)
      const body = await readBody<{ targetUserId?: string; sessionId?: string }>(request)
      return json(companionStore.block(user, body.targetUserId || '', body.sessionId))
    }

    if (request.method === 'POST' && path === '/api/companion/feedback') {
      const user = requireUser(request)
      const body = await readBody<{ sessionId?: string; role?: string; feedback?: string }>(
        request,
      )
      return json(
        companionStore.submitFeedback(user, {
          sessionId: body.sessionId || '',
          role: body.role || 'guest',
          feedback: body.feedback || 'skipped',
        }),
      )
    }

    if (request.method === 'GET' && path === '/api/companion/ai-tip') {
      requireUser(request)
      return json({ tip: companionStore.topicSuggestion(), sharedToChat: false })
    }

    return json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number(err.status) : 400
    const message = err instanceof Error ? err.message : '请求失败'
    const code =
      typeof err === 'object' && err && 'code' in err ? String(err.code) : 'COMPANION_ERROR'
    return json({ error: message, code }, status || 400)
  }
}
