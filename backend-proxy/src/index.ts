import sql from 'mssql'

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

type UpstreamErrorPayload = {
  error?: {
    message?: string
    status?: string
    code?: number
  }
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
  contents?: Array<{
    role?: unknown
    parts?: Array<{
      text?: unknown
    }>
  }>
}

const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

type Provider = 'openai-compatible' | 'gemini'

type ProxyConfig = {
  apiUrl: string | undefined
  apiKey: string
  authHeader: string
  defaultModel: string
  sqlModel: string
  answerModel: string
  provider: Provider
  dataFabricConnectionString: string
  dataFabricServer: string
  dataFabricDatabase: string
  azureTenantId: string
  azureClientId: string
  azureClientSecret: string
  dataFabricSchemaHint: string
  dataFabricMaxRows: number
  dataFabricTimeoutMs: number
}

type QueryRow = Record<string, unknown>

type SchemaRow = {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  COLUMN_NAME: string
  DATA_TYPE: string
}

const DANGEROUS_SQL_KEYWORDS = [
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\balter\b/i,
  /\btruncate\b/i,
  /\bcreate\b/i,
  /\bmerge\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bexec\b/i,
  /\bexecute\b/i,
]

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

function sanitizeGeminiContents(value: IncomingBody['contents']) {
  if (!Array.isArray(value)) {
    throw new TypeError('contents debe ser un arreglo.')
  }

  const normalized = value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const role = item.role
      const firstPart = Array.isArray(item.parts) ? item.parts[0] : undefined
      const text = firstPart?.text

      if (typeof role !== 'string' || (role !== 'user' && role !== 'model')) {
        throw new TypeError('Cada item en contents debe incluir role user o model.')
      }

      if (typeof text !== 'string' || !text.trim()) {
        throw new TypeError('Cada item en contents debe incluir parts[0].text no vacío.')
      }

      return {
        role: role === 'model' ? 'assistant' : 'user',
        content: text.trim(),
      } satisfies { role: ChatRole; content: string }
    })

  if (!normalized.length) {
    throw new TypeError('Debe enviarse al menos un elemento en contents.')
  }

  return normalized
}

function resolveIncomingMessages(parsed: IncomingBody) {
  if (Array.isArray(parsed.messages)) {
    return sanitizeMessages(parsed.messages)
  }

  if (Array.isArray(parsed.contents)) {
    return sanitizeGeminiContents(parsed.contents)
  }

  throw new TypeError('Debes enviar messages o contents en el body.')
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

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function getConfig(): ProxyConfig {
  return {
    apiUrl: process.env.AI_API_URL?.trim(),
    apiKey: process.env.AI_API_KEY?.trim() ?? '',
    authHeader: process.env.AI_AUTH_HEADER?.trim() || 'Authorization',
    defaultModel: process.env.AI_MODEL?.trim() ?? '',
    sqlModel: process.env.AI_SQL_MODEL?.trim() ?? process.env.AI_MODEL?.trim() ?? '',
    answerModel: process.env.AI_ANSWER_MODEL?.trim() ?? process.env.AI_MODEL?.trim() ?? '',
    provider: resolveProvider(),
    dataFabricConnectionString: process.env.DATA_FABRIC_CONNECTION_STRING?.trim() ?? '',
    dataFabricServer: process.env.DATA_FABRIC_SERVER?.trim() ?? '',
    dataFabricDatabase: process.env.DATA_FABRIC_DATABASE?.trim() ?? process.env.ONELAKE_WORKSPACE_NAME?.trim() ?? '',
    azureTenantId: process.env.AZURE_TENANT_ID?.trim() ?? '',
    azureClientId: process.env.AZURE_CLIENT_ID?.trim() ?? '',
    azureClientSecret: process.env.AZURE_CLIENT_SECRET?.trim() ?? '',
    dataFabricSchemaHint: process.env.DATA_FABRIC_SCHEMA_HINT?.trim() ?? '',
    dataFabricMaxRows: parsePositiveInt(process.env.DATA_FABRIC_MAX_ROWS, 100),
    dataFabricTimeoutMs: parsePositiveInt(process.env.DATA_FABRIC_TIMEOUT_SECONDS, 30) * 1000,
  }
}

function normalizeFabricServer(server: string) {
  const trimmed = server.trim()
  if (!trimmed) return ''

  const noProtocol = trimmed.replace(/^tcp:/i, '').replace(/^https?:\/\//i, '')
  const noPort = noProtocol.replace(/:\d+$/, '')
  return noPort.replace(/\/$/, '')
}

function hasServicePrincipalConfig(config: ProxyConfig) {
  return Boolean(
    config.dataFabricServer &&
      config.dataFabricDatabase &&
      config.azureTenantId &&
      config.azureClientId &&
      config.azureClientSecret,
  )
}

function resolveDataFabricPoolConfig(config: ProxyConfig): string | sql.config {
  if (config.dataFabricConnectionString) {
    return config.dataFabricConnectionString
  }

  if (!hasServicePrincipalConfig(config)) {
    throw new Error(
      'Falta configuración de Data Fabric. Define DATA_FABRIC_CONNECTION_STRING o usa DATA_FABRIC_SERVER, DATA_FABRIC_DATABASE, AZURE_TENANT_ID, AZURE_CLIENT_ID y AZURE_CLIENT_SECRET.',
    )
  }

  return {
    server: normalizeFabricServer(config.dataFabricServer),
    database: config.dataFabricDatabase,
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    authentication: {
      type: 'azure-active-directory-service-principal-secret',
      options: {
        tenantId: config.azureTenantId,
        clientId: config.azureClientId,
        clientSecret: config.azureClientSecret,
      },
    },
  }
}

function resolveDataFabricTarget(config: ProxyConfig) {
  if (config.dataFabricConnectionString) {
    const serverMatch = /(?:^|;)\s*server\s*=\s*([^;]+)/i.exec(config.dataFabricConnectionString)
    const databaseMatch = /(?:^|;)\s*(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(
      config.dataFabricConnectionString,
    )

    return {
      server: serverMatch?.[1]?.trim() ?? '(server-no-detectado)',
      database: databaseMatch?.[1]?.trim() ?? '(database-no-detectada)',
    }
  }

  return {
    server: normalizeFabricServer(config.dataFabricServer),
    database: config.dataFabricDatabase,
  }
}

function isInvalidObjectNameError(message: string) {
  return /invalid object name/i.test(message)
}

function buildSchemaHintFromRows(rows: SchemaRow[]) {
  if (!rows.length) return ''

  const tableMap = new Map<string, { schema: string; table: string; columns: string[] }>()

  for (const row of rows) {
    const schema = row.TABLE_SCHEMA?.trim()
    const table = row.TABLE_NAME?.trim()
    const column = row.COLUMN_NAME?.trim()

    if (!schema || !table || !column) continue

    const key = `${schema}.${table}`

    if (!tableMap.has(key)) {
      if (tableMap.size >= 30) continue

      tableMap.set(key, {
        schema,
        table,
        columns: [],
      })
    }

    const tableEntry = tableMap.get(key)

    if (tableEntry && tableEntry.columns.length < 12 && !tableEntry.columns.includes(column)) {
      tableEntry.columns.push(column)
    }
  }

  const lines = Array.from(tableMap.values()).map(
    (entry) => `- [${entry.schema}].[${entry.table}](${entry.columns.join(', ')})`,
  )

  if (!lines.length) return ''

  return ['Tablas disponibles en Data Fabric (usa solo estas):', ...lines].join('\n')
}

async function discoverSchemaHint(config: ProxyConfig) {
  const fabricPoolConfig = resolveDataFabricPoolConfig(config)
  const pool = new sql.ConnectionPool(fabricPoolConfig)

  try {
    await pool.connect()
    const result = await pool.request().query(`
      SELECT TOP (800)
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `)

    return buildSchemaHintFromRows((result.recordset ?? []) as SchemaRow[])
  } catch {
    return ''
  } finally {
    await pool.close()
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

async function completeWithAI(
  config: ProxyConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  model: string,
) {
  if (!config.apiUrl) {
    throw new Error('Falta configurar AI_API_URL.')
  }

  const requestBody = buildRequestBody(config.provider, messages, model)
  const headers = buildHeaders(config.provider, config.authHeader, config.apiKey)
  const upstreamResponse = await requestUpstream(config.apiUrl, headers, requestBody)

  if (!upstreamResponse.ok) {
    const detail = await getUpstreamErrorDetail(upstreamResponse)
    const hint =
      upstreamResponse.status === 429
        ? 'Revisa cuotas/rate limits en Gemini y confirma billing habilitado.'
        : undefined

    const reason = hint ? `${detail} ${hint}` : detail
    throw new Error(reason)
  }

  const payload = (await upstreamResponse.json()) as UpstreamResponse
  return resolveAssistantText(payload)
}

function getLastUserQuestion(messages: Array<{ role: ChatRole; content: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') {
      return messages[index].content
    }
  }

  throw new Error('No se encontró una pregunta del usuario para convertir a SQL.')
}

function unwrapCodeFence(value: string) {
  const fencedRegex = /```(?:sql)?\s*([\s\S]*?)```/i
  const fenced = fencedRegex.exec(value)
  if (fenced?.[1]) return fenced[1].trim()
  return value.trim()
}

function extractSqlCandidate(raw: string) {
  const unwrapped = unwrapCodeFence(raw)
  const singleLine = unwrapped
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')

  if (!singleLine) {
    throw new Error('La IA no devolvió SQL utilizable.')
  }

  return singleLine.replace(/;\s*$/, '')
}

function validateReadOnlySql(sqlQuery: string) {
  const normalized = sqlQuery.trim()
  const lower = normalized.toLowerCase()

  if (!(lower.startsWith('select') || lower.startsWith('with'))) {
    throw new Error('Solo se permiten consultas de lectura (SELECT / WITH).')
  }

  if (DANGEROUS_SQL_KEYWORDS.some((pattern) => pattern.test(lower))) {
    throw new Error('La consulta generada incluye comandos no permitidos para solo lectura.')
  }

  if (lower.includes('--') || lower.includes('/*') || lower.includes('*/')) {
    throw new Error('La consulta generada contiene comentarios SQL no permitidos.')
  }

  return normalized
}

async function generateSqlFromQuestion(config: ProxyConfig, question: string, schemaHint: string, previousError?: string) {
  const systemPrompt = [
    'Eres un asistente que convierte preguntas de negocio a SQL T-SQL para Microsoft Fabric Warehouse.',
    'Devuelve solo una consulta SQL de lectura (SELECT o WITH).',
    'Usa nombres calificados con esquema, por ejemplo [dbo].[MiTabla].',
    'No uses INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, EXEC ni múltiples sentencias.',
    'No incluyas explicación ni markdown.',
    schemaHint
      ? `Contexto de esquema/tablas disponible:\n${schemaHint}`
      : 'Si no conoces columnas exactas, usa nombres razonables y consulta conservadora.',
    previousError
      ? `Error previo al ejecutar SQL (evita repetirlo): ${previousError}`
      : 'Asegúrate de que todas las tablas/columnas existan en el contexto.',
  ].join('\n\n')

  const sqlDraft = await completeWithAI(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    config.sqlModel,
  )

  const sqlCandidate = extractSqlCandidate(sqlDraft)
  return validateReadOnlySql(sqlCandidate)
}

async function executeSqlQuery(config: ProxyConfig, sqlQuery: string) {
  const fabricPoolConfig = resolveDataFabricPoolConfig(config)
  const target = resolveDataFabricTarget(config)
  const pool = new sql.ConnectionPool(fabricPoolConfig)

  try {
    await pool.connect()
    const request = pool.request()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`La consulta SQL excedió el timeout de ${config.dataFabricTimeoutMs} ms.`))
      }, config.dataFabricTimeoutMs)
    })

    const result = await Promise.race([request.query(sqlQuery), timeoutPromise])
    const records = (result.recordset ?? []) as QueryRow[]
    return records.slice(0, config.dataFabricMaxRows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al consultar Data Fabric.'

    if (/database was not found|insufficient permissions to connect to it|login failed/i.test(message)) {
      throw new Error(
        `${message} (target: server=${target.server}, database=${target.database}). ` +
          'Verifica que DATA_FABRIC_DATABASE sea el nombre exacto del Warehouse/SQL endpoint y que el Service Principal tenga permisos de acceso y lectura.',
      )
    }

    throw new Error(`${message} (target: server=${target.server}, database=${target.database})`)
  } finally {
    await pool.close()
  }
}

function summarizeRows(rows: QueryRow[]) {
  if (!rows.length) return '[]'
  return JSON.stringify(rows)
}

async function answerWithData(
  config: ProxyConfig,
  question: string,
  sqlQuery: string,
  rows: QueryRow[],
) {
  const rowsSummary = summarizeRows(rows)

  const systemPrompt = [
    'Eres un asesor financiero y debes responder solo con base en los datos SQL entregados.',
    'Si no hay datos suficientes, dilo claramente y sugiere qué dato faltaría.',
    'Responde en español de forma clara y accionable.',
  ].join('\n\n')

  const userPrompt = [
    `Pregunta del usuario: ${question}`,
    `SQL ejecutado: ${sqlQuery}`,
    `Filas resultantes (JSON): ${rowsSummary}`,
    'Genera una respuesta final para el usuario.',
  ].join('\n\n')

  return completeWithAI(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    config.answerModel,
  )
}

async function handleDirectChat(
  config: ProxyConfig,
  parsed: IncomingBody,
  messages: Array<{ role: ChatRole; content: string }>,
) {
  const model = resolveModel(parsed.model, config.defaultModel)
  const message = await completeWithAI(config, messages, model)
  return { message }
}

async function handleDataFabricAgentFlow(config: ProxyConfig, messages: Array<{ role: ChatRole; content: string }>) {
  const question = getLastUserQuestion(messages)
  const discoveredSchemaHint = await discoverSchemaHint(config)
  const baseSchemaHint = [config.dataFabricSchemaHint, discoveredSchemaHint].filter(Boolean).join('\n\n').trim()

  let sqlQuery = await generateSqlFromQuestion(config, question, baseSchemaHint)
  let rows: QueryRow[] = []

  try {
    rows = await executeSqlQuery(config, sqlQuery)
  } catch (error) {
    const firstError = error instanceof Error ? error.message : 'Error desconocido al ejecutar SQL.'

    if (!isInvalidObjectNameError(firstError)) {
      throw error
    }

    const retrySchemaHint = await discoverSchemaHint(config)
    const mergedRetryHint = [config.dataFabricSchemaHint, retrySchemaHint].filter(Boolean).join('\n\n').trim()

    sqlQuery = await generateSqlFromQuestion(config, question, mergedRetryHint, firstError)
    rows = await executeSqlQuery(config, sqlQuery)
  }

  const message = await answerWithData(config, question, sqlQuery, rows)

  return {
    message,
    meta: {
      sql: sqlQuery,
      rows: rows.length,
      source: 'data-fabric',
    },
  }
}

async function getUpstreamErrorDetail(response: Response) {
  try {
    const payload = (await response.json()) as UpstreamErrorPayload
    const message = payload.error?.message?.trim()
    const status = payload.error?.status?.trim()

    if (message && status) return `${status}: ${message}`
    if (message) return message
  } catch {
    // Fallback to generic status below.
  }

  return `El proveedor IA respondió con estado ${response.status}.`
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

  const config = getConfig()

  if (!config.apiUrl) {
    return jsonResponse(500, { error: 'Falta configurar AI_API_URL.' }, allowedOrigin)
  }

  try {
    const parsed = JSON.parse(event.body ?? '{}') as IncomingBody
    const messages = resolveIncomingMessages(parsed)
    const useDataFabricFlow = Boolean(config.dataFabricConnectionString || hasServicePrincipalConfig(config))

    if (!useDataFabricFlow) {
      const directResult = await handleDirectChat(config, parsed, messages)
      return jsonResponse(200, directResult, allowedOrigin)
    }

    const dataFabricResult = await handleDataFabricAgentFlow(config, messages)
    return jsonResponse(200, dataFabricResult, allowedOrigin)
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Error inesperado del proxy.'
    return jsonResponse(400, { error: safeMessage }, allowedOrigin)
  }
}
