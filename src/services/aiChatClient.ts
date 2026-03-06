import type { ChatMessage } from '../types/ui'

type ChatRole = 'system' | 'user' | 'assistant'

type ChatCompletionRequest = {
  model?: string
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
  /^el servicio de ia respondio con estado/i,
  /^resource_exhausted:/i,
  /^metodo no permitido/i,
  /^falta configurar /i,
]

function isLocalErrorAssistantMessage(role: ChatRole, content: string) {
  if (role !== 'assistant') return false
  return LOCAL_ERROR_PATTERNS.some((pattern) => pattern.test(content))
}

function mapToRequestMessages(messages: ChatMessage[]) {
  return messages
    .map(({ role, content }) => ({ role, content: content.trim() }))
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

export async function requestAssistantReply(messages: ChatMessage[]) {
  const { apiUrl, apiKey, model, authHeader } = getApiConfig()

  if (!apiUrl) {
    throw new Error('Configura VITE_AI_API_URL para habilitar respuestas del agente de IA.')
  }

  const body: ChatCompletionRequest = {
    messages: mapToRequestMessages(messages),
    ...(model ? { model } : {}),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers[authHeader] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    try {
      const payload = (await response.json()) as ChatErrorResponse
      const detail = payload.error?.trim() || payload.message?.trim()

      if (detail) {
        throw new Error(detail)
      }
    } catch {
      // Fallback to generic status error.
    }

    throw new Error(`El servicio de IA respondió con estado ${response.status}.`)
  }

  const payload = (await response.json()) as ChatCompletionResponse
  return resolveAssistantText(payload)
}
