export const AI_MAX_INPUT_CHARS = 500
export const AI_MAX_CONTEXT_MESSAGES = 12

export type AiGenerationStatus =
  | 'idle'
  | 'generating'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'ended'

export function validateUserInput(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return '请输入想说的话。'
  if (trimmed.length > AI_MAX_INPUT_CHARS) {
    return `消息过长，请控制在 ${AI_MAX_INPUT_CHARS} 字以内。`
  }
  return null
}

export function generationStatusLabel(status: AiGenerationStatus): string {
  switch (status) {
    case 'idle':
      return '未开始生成'
    case 'generating':
      return 'AI 回复中'
    case 'success':
      return 'AI 回复成功'
    case 'failed':
      return '请求失败'
    case 'cancelled':
      return '已取消生成'
    case 'ended':
      return '会话已结束'
  }
}
