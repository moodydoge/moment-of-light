import { describe, expect, it } from 'vitest'
import {
  AI_MAX_INPUT_CHARS,
  generationStatusLabel,
  validateUserInput,
} from './aiLimits'

describe('aiLimits', () => {
  it('rejects empty and oversized input', () => {
    expect(validateUserInput('   ')).toBeTruthy()
    expect(validateUserInput('你好')).toBeNull()
    expect(validateUserInput('x'.repeat(AI_MAX_INPUT_CHARS + 1))).toMatch(/过长/)
  })

  it('labels generation states', () => {
    expect(generationStatusLabel('generating')).toBe('AI 回复中')
    expect(generationStatusLabel('cancelled')).toBe('已取消生成')
    expect(generationStatusLabel('ended')).toBe('会话已结束')
  })
})
