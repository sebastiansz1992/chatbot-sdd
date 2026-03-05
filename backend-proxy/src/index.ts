type ChatRole = 'system' | 'user' | 'assistant'

type UpstreamRequest = {
  model?: string
  messages: Array<{ role: ChatRole; content: string }>
}

type UpstreamResponse = {
  content?: string
  message?: string
  output_text?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

type LambdaEvent = {
  httpMethod?: string
  body: string | null
}

type LambdaResult = {
  statusCode: number
  headers: Record<string, string>
  body: string
}

type IncomingBody = {
  model?: unknown
  messages?: Array<{ role?: unknown; content?: unknown }>
}

const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

type Provider = 'openai-compatible' | 'gemini'

function resolveProvider(): Provider {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase()

  if (configured === 'gemini') return 'gemini'
  return 'openai-compatible'
}

function jsonResponse(
  statusCode: number,
  body: Record<string, unknown>,
  allowedOrigin: string,
): LambdaResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function sanitizeMessages(value: IncomingBody['messages']) {
  if (!Array.isArray(value)) {
    throw new TypeError('messages debe ser un arreglo.')
  }

  const sanitized = value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const role = item.role
      const content = item.content

      if (typeof role !== 'string' || !ALLOWED_ROLES.has(role as ChatRole)) {
        throw new TypeError('Cada mensaje debe incluir un role válido.')
      }

      if (typeof content !== 'string' || !content.trim()) {
        throw new TypeError('Cada mensaje debe incluir content no vacío.')
      }

      return {
        role: role as ChatRole,
        content: content.trim(),
      }
    })

  if (!sanitized.length) {
    throw new TypeError('Debe enviarse al menos un mensaje.')
  }

  return sanitized
}

function resolveAssistantText(payload: UpstreamResponse) {
  if (payload.content?.trim()) return payload.content.trim()
  if (payload.message?.trim()) return payload.message.trim()
  if (payload.output_text?.trim()) return payload.output_text.trim()

  const choiceText = payload.choices?.[0]?.message?.content?.trim()
  if (choiceText) return choiceText

  const geminiText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (geminiText) return geminiText

  throw new Error('El proveedor IA no devolvió contenido legible.')
}

function mapMessagesForGemini(messages: Array<{ role: ChatRole; content: string }>) {
  const systemMessages = messages.filter((message) => message.role === 'system')
  const conversationMessages = messages.filter((message) => message.role !== 'system')

  const contents = conversationMessages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

  return {
    ...(systemMessages.length
      ? {
          systemInstruction: {
            parts: [{ text: systemMessages.map((message) => message.content).join('\n') }],
          },
        }
      : {}),
    contents,
  }
}

function getConfig() {
  return {
    apiUrl: process.env.AI_API_URL?.trim(),
    apiKey: process.env.AI_API_KEY?.trim() ?? '',
    authHeader: process.env.AI_AUTH_HEADER?.trim() || 'Authorization',
    defaultModel: process.env.AI_MODEL?.trim() ?? '',
    provider: resolveProvider(),
  }
}

function resolveModel(inputModel: unknown, defaultModel: string) {
  if (typeof inputModel === 'string' && inputModel.trim()) return inputModel.trim()
  return defaultModel
}

function buildRequestBody(
  provider: Provider,
  messages: Array<{ role: ChatRole; content: string }>,
  model: string,
) {
  if (provider === 'gemini') {
    return {
      ...mapMessagesForGemini(messages),
      ...(model ? { model } : {}),
    }
  }

  return {
    messages,
    ...(model ? { model } : {}),
  }
}

function buildHeaders(provider: Provider, authHeader: string, apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (!apiKey) return headers

  if (provider === 'gemini') {
    headers[authHeader] = apiKey
    return headers
  }

  headers[authHeader] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
  return headers
}

async function requestUpstream(apiUrl: string, headers: Record<string, string>, body: Record<string, unknown>) {
  return fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

export async function handler(event: LambdaEvent): Promise<LambdaResult> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim() || '*'
  const method = event.httpMethod ?? 'POST'

  if (method === 'OPTIONS') {
    return jsonResponse(204, {}, allowedOrigin)
  }

  if (method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' }, allowedOrigin)
  }

  const { apiUrl, apiKey, authHeader, defaultModel, provider } = getConfig()

  if (!apiUrl) {
    return jsonResponse(500, { error: 'Falta configurar AI_API_URL.' }, allowedOrigin)
  }

  try {
    const parsed = JSON.parse(event.body ?? '{}') as IncomingBody
    const messages = sanitizeMessages(parsed.messages)
    const model = resolveModel(parsed.model, defaultModel)
    const requestBody = buildRequestBody(provider, messages, model)
    const headers = buildHeaders(provider, authHeader, apiKey)

    const upstreamResponse = await requestUpstream(apiUrl, headers, requestBody)

    if (!upstreamResponse.ok) {
      return jsonResponse(
        upstreamResponse.status,
        { error: `El proveedor IA respondió con estado ${upstreamResponse.status}.` },
        allowedOrigin,
      )
    }

    const payload = (await upstreamResponse.json()) as UpstreamResponse
    const message = resolveAssistantText(payload)
    return jsonResponse(200, { message }, allowedOrigin)
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Error inesperado del proxy.'
    return jsonResponse(400, { error: safeMessage }, allowedOrigin)
  }
}
