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

function getApiConfig() {
  return {
    apiUrl: import.meta.env.VITE_AI_API_URL?.trim() ?? '',
    apiKey: import.meta.env.VITE_AI_API_KEY?.trim() ?? '',
    model: import.meta.env.VITE_AI_MODEL?.trim() ?? '',
    authHeader: import.meta.env.VITE_AI_AUTH_HEADER?.trim() || 'Authorization',
  }
}

function mapToRequestMessages(messages: ChatMessage[]) {
  return messages.map(({ role, content }) => ({
    role,
    content,
  }))
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
    throw new Error(`El servicio de IA respondió con estado ${response.status}.`)
  }

  const payload = (await response.json()) as ChatCompletionResponse
  return resolveAssistantText(payload)
}
