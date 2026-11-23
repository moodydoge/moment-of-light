import type { AiStatus, AppServices, CompanionAIService } from './contracts'
import { DemoAIService } from './demo/DemoAIService'
import { DemoChatService } from './demo/DemoChatService'
import { DemoFeedbackService } from './demo/DemoFeedbackService'
import { DemoMatchingService } from './demo/DemoMatchingService'
import { fetchAiStatus, LiveAIService } from './live/LiveAIService'

export interface MomentServices extends AppServices {
  matching: DemoMatchingService
  chat: DemoChatService
  feedback: DemoFeedbackService
}

export async function createAppServices(): Promise<MomentServices> {
  const aiStatus = await fetchAiStatus()
  const forceDemo = import.meta.env.VITE_MOL_FORCE_DEMO_AI === 'true'
  const useLive = aiStatus.configured && !forceDemo

  const ai: CompanionAIService = useLive ? new LiveAIService() : new DemoAIService()
  const status: AiStatus = useLive
    ? aiStatus
    : {
        configured: false,
        kind: 'unavailable',
        model: null,
        baseUrlHost: aiStatus.baseUrlHost,
      }

  return {
    ai,
    aiStatus: status,
    matching: new DemoMatchingService(),
    chat: new DemoChatService(),
    feedback: new DemoFeedbackService(),
  }
}
