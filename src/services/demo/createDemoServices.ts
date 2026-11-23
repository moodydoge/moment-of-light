import type { AppServices } from '../contracts'
import { DemoAIService } from './DemoAIService'
import { DemoChatService } from './DemoChatService'
import { DemoFeedbackService } from './DemoFeedbackService'
import { DemoMatchingService } from './DemoMatchingService'

export interface DemoServices extends AppServices {
  ai: DemoAIService
  matching: DemoMatchingService
  chat: DemoChatService
  feedback: DemoFeedbackService
}

export function createDemoServices(): DemoServices {
  return {
    ai: new DemoAIService(),
    aiStatus: {
      configured: false,
      kind: 'unavailable',
      model: null,
    },
    matching: new DemoMatchingService(),
    chat: new DemoChatService(),
    feedback: new DemoFeedbackService(),
  }
}
