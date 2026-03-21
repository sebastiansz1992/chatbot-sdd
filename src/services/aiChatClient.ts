import type { ChatMessage } from '../types/ui'
import type { Language } from '../i18n/translations'

type ChatRole = 'system' | 'user' | 'assistant'

type ChatCompletionRequest = {
  model?: string
  language?: Language
  messages: Array<{ role: ChatRole; content: string }>
}

type ChatCompletionResponse = {
  content?: string
  message?: string
  output_text?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type ChatErrorResponse = {
  error?: string
  message?: string
}

function getApiConfig() {
  return {
    apiUrl: import.meta.env.VITE_AI_API_URL?.trim() ?? '',
    apiKey: import.meta.env.VITE_AI_API_KEY?.trim() ?? '',
    model: import.meta.env.VITE_AI_MODEL?.trim() ?? '',
    authHeader: import.meta.env.VITE_AI_AUTH_HEADER?.trim() || 'Authorization',
  }
}

const LOCAL_ERROR_PATTERNS = [
  /^failed to fetch$/i,
  /^no pude responder en este momento/i,
  /^i could not respond at this time/i,
  /^el servicio de ia respondio con estado/i,
  /^resource_exhausted:/i,
  /^metodo no permitido/i,
  /^falta configurar /i,
]

function isLocalErrorAssistantMessage(role: ChatRole, content: string) {
  if (role !== 'assistant') return false
  return LOCAL_ERROR_PATTERNS.some((pattern) => pattern.test(content))
}

function stripHtmlTags(value: string) {
  return value.replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' ').trim()
}

function mapToRequestMessages(messages: ChatMessage[]) {
  return messages
    .map(({ role, content }) => ({
      role,
      content: role === 'assistant' ? stripHtmlTags(content) : content.trim(),
    }))
    .filter(({ content }) => content.length > 0)
    .filter(({ role, content }) => !isLocalErrorAssistantMessage(role, content))
}

function resolveAssistantText(payload: ChatCompletionResponse) {
  if (payload.content?.trim()) return payload.content.trim()
  if (payload.message?.trim()) return payload.message.trim()
  if (payload.output_text?.trim()) return payload.output_text.trim()

  const choiceText = payload.choices?.[0]?.message?.content?.trim()
  if (choiceText) return choiceText

  throw new Error('La respuesta de IA no contiene contenido legible.')
}

const RETRYABLE_STATUSES = new Set([403, 429, 502, 503, 504])
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeRequest(
  apiUrl: string,
  headers: Record<string, string>,
  body: ChatCompletionRequest,
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail: string | undefined

    try {
      const payload = (await response.json()) as ChatErrorResponse
      detail = payload.error?.trim() || payload.message?.trim()
    } catch {
      // Fallback to generic status error.
    }

    const error = new Error(
      detail || `El servicio de IA respondió con estado ${response.status}.`,
    )
    ;(error as Error & { status: number }).status = response.status
    throw error
  }

  const payload = (await response.json()) as ChatCompletionResponse
  return resolveAssistantText(payload)
}

export async function requestAssistantReply(messages: ChatMessage[], language: Language) {
  const { apiUrl, apiKey, model, authHeader } = getApiConfig()

  if (!apiUrl) {
    throw new Error('Configura VITE_AI_API_URL para habilitar respuestas del agente de IA.')
  }

  const body: ChatCompletionRequest = {
    messages: mapToRequestMessages(messages),
    language,
    ...(model ? { model } : {}),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers[authHeader] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
  }

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeRequest(apiUrl, headers, body)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const status = (error as Error & { status?: number }).status

      if (!status || !RETRYABLE_STATUSES.has(status) || attempt === MAX_RETRIES) {
        throw lastError
      }

      await wait(RETRY_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError
}
