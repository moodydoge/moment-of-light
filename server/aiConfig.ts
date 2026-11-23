/**
 * Server-only AI configuration.
 * Keys must never be exposed to the Vite client bundle.
 */

export interface AiRuntimeConfig {
  configured: boolean
  apiKey: string | null
  baseUrl: string
  model: string
  timeoutMs: number
  maxOutputTokens: number
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function loadAiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiRuntimeConfig {
  const apiKey = env.MOL_AI_API_KEY?.trim() || null
  const baseUrl = trimSlash(
    env.MOL_AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
  )
  const model = env.MOL_AI_MODEL?.trim() || 'gpt-4o-mini'
  const timeoutMs = Number(env.MOL_AI_TIMEOUT_MS || 45_000)
  const maxOutputTokens = Number(env.MOL_AI_MAX_OUTPUT_TOKENS || 400)

  return {
    configured: Boolean(apiKey),
    apiKey,
    baseUrl,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 45_000,
    maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 400,
  }
}

export function publicAiStatus(config: AiRuntimeConfig) {
  return {
    configured: config.configured,
    kind: config.configured ? ('live' as const) : ('unavailable' as const),
    model: config.configured ? config.model : null,
    baseUrlHost: safeHost(config.baseUrl),
    /** Never include the API key. */
  }
}

function safeHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host
  } catch {
    return 'invalid-base-url'
  }
}
