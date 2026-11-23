import type { CompanionRequest, CompanionSession, MatchStatus } from '../../types'
import { createId } from '../../lib/id'
import type { MatchingService } from '../contracts'

const DEMO_SEED: CompanionRequest[] = [
  {
    id: 'req_demo_01',
    sessionId: 'sess_demo_seed_01',
    anonymousLabel: '匿名请求 · 灯火 A',
    topicLabels: ['今天的天气', '想安静一会儿'],
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    status: 'open',
    demo: true,
  },
  {
    id: 'req_demo_02',
    sessionId: 'sess_demo_seed_02',
    anonymousLabel: '匿名请求 · 窗边 B',
    topicLabels: ['一件小好事'],
    createdAt: new Date(Date.now() - 28 * 60_000).toISOString(),
    status: 'open',
    demo: true,
  },
]

export class DemoMatchingService implements MatchingService {
  readonly kind = 'demo' as const
  private requests: CompanionRequest[] = [...DEMO_SEED]
  private emptyMode = false

  setEmptyMode(empty: boolean) {
    this.emptyMode = empty
  }

  async openRequest(input: {
    session: CompanionSession
    topicLabels: string[]
  }): Promise<CompanionRequest> {
    await delay(300)
    const request: CompanionRequest = {
      id: createId('req'),
      sessionId: input.session.id,
      anonymousLabel: `匿名请求 · ${input.session.id.slice(-4).toUpperCase()}`,
      topicLabels: input.topicLabels,
      createdAt: new Date().toISOString(),
      status: 'open',
      demo: true,
    }
    this.requests = [request, ...this.requests.filter((r) => r.sessionId !== input.session.id)]
    return request
  }

  async listOpenRequests(): Promise<CompanionRequest[]> {
    await delay(200)
    if (this.emptyMode) return []
    return this.requests.filter((r) => r.status === 'open')
  }

  async cancelRequest(requestId: string): Promise<void> {
    await delay(150)
    this.updateStatus(requestId, 'cancelled')
  }

  async applyToJoin(requestId: string): Promise<{ pendingConfirm: boolean }> {
    await delay(250)
    const req = this.requests.find((r) => r.id === requestId)
    if (!req || req.status !== 'open') {
      throw new Error('该请求已不可接入（已取消、过期或不存在）。')
    }
    this.updateStatus(requestId, 'pending_confirm')
    return { pendingConfirm: true }
  }

  async confirmJoin(sessionId: string): Promise<void> {
    await delay(150)
    const req = this.requests.find((r) => r.sessionId === sessionId)
    if (req) this.updateStatus(req.id, 'matched')
  }

  async rejectJoin(sessionId: string): Promise<void> {
    await delay(150)
    const req = this.requests.find((r) => r.sessionId === sessionId)
    if (req) this.updateStatus(req.id, 'open')
  }

  private updateStatus(requestId: string, status: MatchStatus) {
    this.requests = this.requests.map((r) =>
      r.id === requestId ? { ...r, status } : r,
    )
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
