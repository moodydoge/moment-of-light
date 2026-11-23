import type { BlockAction, ReportAction, SessionFeedback } from '../../types'
import { createId } from '../../lib/id'
import type { FeedbackService } from '../contracts'

export class DemoFeedbackService implements FeedbackService {
  readonly kind = 'demo' as const
  readonly feedbacks: SessionFeedback[] = []
  readonly reports: ReportAction[] = []
  readonly blocks: BlockAction[] = []

  async submit(
    feedback: Omit<SessionFeedback, 'createdAt' | 'verifiedOutcome'>,
  ): Promise<SessionFeedback> {
    await delay(200)
    const record: SessionFeedback = {
      ...feedback,
      createdAt: new Date().toISOString(),
      verifiedOutcome: false,
    }
    this.feedbacks.push(record)
    return record
  }

  async report(
    action: Omit<ReportAction, 'id' | 'createdAt'>,
  ): Promise<ReportAction> {
    await delay(200)
    const record: ReportAction = {
      ...action,
      id: createId('report'),
      createdAt: new Date().toISOString(),
    }
    this.reports.push(record)
    return record
  }

  async block(
    action: Omit<BlockAction, 'id' | 'createdAt'>,
  ): Promise<BlockAction> {
    await delay(200)
    const record: BlockAction = {
      ...action,
      id: createId('block'),
      createdAt: new Date().toISOString(),
    }
    this.blocks.push(record)
    return record
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
