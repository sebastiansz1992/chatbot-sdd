import sql from 'mssql'

type ChatRole = 'system' | 'user' | 'assistant'

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

type Language = 'es' | 'en'

type IncomingBody = {
  model?: unknown
  language?: unknown
  messages?: Array<{ role?: unknown; content?: unknown }>
  contents?: Array<{
    role?: unknown
    parts?: Array<{
      text?: unknown
    }>
  }>
}

type Provider = 'openai-compatible' | 'gemini'

// Represents the outcome of SQL generation:
// - sql: a validated read-only SQL query ready to execute
// - conversational: the question doesn't need database data
type SqlRouteResult =
  | { type: 'sql'; query: string }
  | { type: 'conversational' }

const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

type ProxyConfig = {
  apiUrl: string | undefined
  apiKey: string
  authHeader: string
  defaultModel: string
  sqlModel: string
  answerModel: string
  provider: Provider
  dbConnectionString: string
  dbServer: string
  dbDatabase: string
  dbUser: string
  dbPassword: string
  azureTenantId: string
  azureClientId: string
  azureClientSecret: string
  dbAllowedSchema: string
  // empty list = allow any table in dbAllowedSchema; non-empty = restrict to these tables
  dbAllowedTables: string[]
  dbSchemaHint: string
  dbMaxRows: number
  dbTimeoutMs: number
}

type QueryRow = Record<string, unknown>

type SchemaRow = {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  COLUMN_NAME: string
  DATA_TYPE: string
}

// ─── conversational memory (simple in-memory) ───────────────────────────────

type ConversationMemory = {
  lastQuery?: string
  lastPeriod?: string
  lastResult?: QueryRow[]
}

const memoryStore = new Map<string, ConversationMemory>()

function getSessionId(messages: Array<{ role: ChatRole; content: string }>) {
  // puedes mejorar esto con userId real
  return 'default-session'
}

function getMemory(sessionId: string): ConversationMemory {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, {})
  }
  return memoryStore.get(sessionId)!
}

// ─── simple cache ───────────────────────────────────────────────────────────

const queryCache = new Map<string, QueryRow[]>()
const queryCacheTimestamps = new Map<string, number>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getCacheKey(query: string) {
  return query.toLowerCase().trim()
}

function detectKPIs(question: string) {
  const q = question.toLowerCase()

  return {
    needsMargin: q.includes('margen'),
    needsEbitda: q.includes('ebitda'),
    needsComparison:
      q.includes('comparar') ||
      q.includes('vs') ||
      q.includes('mes pasado'),
  }
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

function extractPeriod(text: string): string | undefined {
  const match = /\b(\d{4}-(?:0[1-9]|1[0-2]))\b/.exec(text)
  return match?.[1]
}

function enrichQuestionWithMemory(
  question: string,
  memory: ConversationMemory,
) {
  let enriched = question

  if (question.toLowerCase().includes('mes pasado') && memory.lastPeriod) {
    enriched += ` (usar periodo anterior a ${memory.lastPeriod})`
  }

  if (question.toLowerCase().includes('compáralo') && memory.lastQuery) {
    enriched += ` (comparar con: ${memory.lastQuery})`
  }

  return enriched
}

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveProvider(): Provider {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (configured === 'gemini') return 'gemini'
  return 'openai-compatible'
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseAllowedTables(multiTable: string, singleTable: string): string[] {
  if (multiTable) {
    return multiTable
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  }
  if (singleTable) return [singleTable.trim().toLowerCase()]
  return []
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

// ─── config ─────────────────────────────────────────────────────────────────

function getConfig(): ProxyConfig {
  return {
    apiUrl: process.env.AI_API_URL?.trim(),
    apiKey: process.env.AI_API_KEY?.trim() ?? '',
    authHeader: process.env.AI_AUTH_HEADER?.trim() || 'Authorization',
    defaultModel: process.env.AI_MODEL?.trim() ?? '',
    sqlModel: process.env.AI_SQL_MODEL?.trim() ?? process.env.AI_MODEL?.trim() ?? '',
    answerModel: process.env.AI_ANSWER_MODEL?.trim() ?? process.env.AI_MODEL?.trim() ?? '',
    provider: resolveProvider(),
    dbConnectionString: process.env.DB_CONNECTION_STRING?.trim() ?? '',
    dbServer: process.env.DB_SERVER?.trim() ?? '',
    dbDatabase: process.env.DB_DATABASE?.trim() ?? '',
    dbUser: process.env.DB_USER?.trim() ?? '',
    dbPassword: process.env.DB_PASSWORD?.trim() ?? '',
    azureTenantId: process.env.AZURE_TENANT_ID?.trim() ?? '',
    azureClientId: process.env.AZURE_CLIENT_ID?.trim() ?? '',
    azureClientSecret: process.env.AZURE_CLIENT_SECRET?.trim() ?? '',
    dbAllowedSchema: process.env.DB_ALLOWED_SCHEMA?.trim() ?? 'dbo',
    dbAllowedTables: parseAllowedTables(
      process.env.DB_ALLOWED_TABLES?.trim() ?? '',
      process.env.DB_ALLOWED_TABLE?.trim() ?? '',
    ),
    dbSchemaHint: process.env.DB_SCHEMA_HINT?.trim() ?? '',
    dbMaxRows: parsePositiveInt(process.env.DB_MAX_ROWS, 100),
    dbTimeoutMs: parsePositiveInt(process.env.DB_TIMEOUT_SECONDS, 30) * 1000,
  }
}

// ─── input sanitization ─────────────────────────────────────────────────────

function sanitizeMessages(value: IncomingBody['messages']) {
  if (!Array.isArray(value)) throw new TypeError('messages debe ser un arreglo.')

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
      return { role: role as ChatRole, content: content.trim() }
    })

  if (!sanitized.length) throw new TypeError('Debe enviarse al menos un mensaje.')
  return sanitized
}

function sanitizeGeminiContents(value: IncomingBody['contents']) {
  if (!Array.isArray(value)) throw new TypeError('contents debe ser un arreglo.')

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

  if (!normalized.length) throw new TypeError('Debe enviarse al menos un elemento en contents.')
  return normalized
}

function resolveIncomingMessages(parsed: IncomingBody) {
  if (Array.isArray(parsed.messages)) return sanitizeMessages(parsed.messages)
  if (Array.isArray(parsed.contents)) return sanitizeGeminiContents(parsed.contents)
  throw new TypeError('Debes enviar messages o contents en el body.')
}

// ─── AI provider layer ──────────────────────────────────────────────────────

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
  const systemMessages = messages.filter((m) => m.role === 'system')
  const conversationMessages = messages.filter((m) => m.role !== 'system')
  const contents = conversationMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  return {
    ...(systemMessages.length
      ? { systemInstruction: { parts: [{ text: systemMessages.map((m) => m.content).join('\n') }] } }
      : {}),
    contents,
  }
}

function buildRequestBody(
  provider: Provider,
  messages: Array<{ role: ChatRole; content: string }>,
  model: string,
) {
  if (provider === 'gemini') {
    return { ...mapMessagesForGemini(messages), ...(model ? { model } : {}) }
  }
  return { messages, ...(model ? { model } : {}) }
}

function buildHeaders(provider: Provider, authHeader: string, apiKey: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!apiKey) return headers
  if (provider === 'gemini') {
    headers[authHeader] = apiKey
    return headers
  }
  // 'api-key' header (Azure OpenAI key-based auth) expects the raw key without Bearer prefix
  if (authHeader.toLowerCase() === 'api-key') {
    headers[authHeader] = apiKey
  } else {
    headers[authHeader] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
  }
  return headers
}

async function requestUpstream(
  apiUrl: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) {
  return fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
}

async function getUpstreamErrorDetail(response: Response) {
  try {
    const payload = (await response.json()) as UpstreamErrorPayload
    const message = payload.error?.message?.trim()
    const status = payload.error?.status?.trim()
    if (message && status) return `${status}: ${message}`
    if (message) return message
  } catch {
    // fall through
  }
  return `El proveedor IA respondió con estado ${response.status}.`
}

async function completeWithAI(
  config: ProxyConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  model: string,
): Promise<string> {
  if (!config.apiUrl) throw new Error('Falta configurar AI_API_URL.')
  const requestBody = buildRequestBody(config.provider, messages, model)
  const headers = buildHeaders(config.provider, config.authHeader, config.apiKey)
  const upstreamResponse = await requestUpstream(config.apiUrl, headers, requestBody)
  if (!upstreamResponse.ok) {
    const detail = await getUpstreamErrorDetail(upstreamResponse)
    const hint =
      upstreamResponse.status === 429
        ? 'Revisa cuotas/rate limits en Gemini y confirma billing habilitado.'
        : undefined
    throw new Error(hint ? `${detail} ${hint}` : detail)
  }
  const payload = (await upstreamResponse.json()) as UpstreamResponse
  return resolveAssistantText(payload)
}

// ─── DB connection ──────────────────────────────────────────────────────────

function normalizeDbServer(server: string) {
  const trimmed = server.trim()
  if (!trimmed) return ''
  const noProtocol = trimmed.replace(/^tcp:/i, '').replace(/^https?:\/\//i, '')
  const noPort = noProtocol.replace(/,\d+$/, '').replace(/:\d+$/, '')
  return noPort.replace(/\/$/, '')
}

function hasSqlAuthConfig(config: ProxyConfig) {
  return Boolean(config.dbServer && config.dbDatabase && config.dbUser && config.dbPassword)
}

function hasServicePrincipalConfig(config: ProxyConfig) {
  return Boolean(
    config.dbServer &&
      config.dbDatabase &&
      config.azureTenantId &&
      config.azureClientId &&
      config.azureClientSecret,
  )
}

function resolveDbPoolConfig(config: ProxyConfig): string | sql.config {
  if (config.dbConnectionString) return config.dbConnectionString

  if (hasSqlAuthConfig(config)) {
    return {
      server: normalizeDbServer(config.dbServer),
      database: config.dbDatabase,
      port: 1433,
      user: config.dbUser,
      password: config.dbPassword,
      options: { encrypt: true, trustServerCertificate: false },
      connectionTimeout: config.dbTimeoutMs
    }
  }

  if (hasServicePrincipalConfig(config)) {
    return {
      server: normalizeDbServer(config.dbServer),
      database: config.dbDatabase,
      port: 1433,
      connectionTimeout: config.dbTimeoutMs,
      options: { encrypt: true, trustServerCertificate: false },
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

  throw new Error(
    'Falta configuración de base de datos. Define DB_CONNECTION_STRING, o bien ' +
      'DB_SERVER + DB_DATABASE + DB_USER + DB_PASSWORD (SQL auth), o ' +
      'DB_SERVER + DB_DATABASE + AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET (Service Principal).',
  )
}

function resolveDbTarget(config: ProxyConfig) {
  if (config.dbConnectionString) {
    const serverMatch = /(?:^|;)\s*(?:server|data source)\s*=\s*([^;]+)/i.exec(
      config.dbConnectionString,
    )
    const databaseMatch = /(?:^|;)\s*(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(
      config.dbConnectionString,
    )
    return {
      server: serverMatch?.[1]?.trim() ?? '(server-no-detectado)',
      database: databaseMatch?.[1]?.trim() ?? '(database-no-detectada)',
    }
  }
  return { server: normalizeDbServer(config.dbServer), database: config.dbDatabase }
}

// ─── SQL validation ──────────────────────────────────────────────────────────

function normalizeSqlIdentifier(identifier: string) {
  return identifier.replaceAll(/[[\]"`]/g, '').trim().toLowerCase()
}

function resolveBaseTableName(identifier: string) {
  const normalized = normalizeSqlIdentifier(identifier)
  return normalized.split('.').filter(Boolean).at(-1) ?? ''
}

function resolveSchemaAndTable(identifier: string) {
  const segments = normalizeSqlIdentifier(identifier).split('.').filter(Boolean)
  if (segments.length < 2) return { schema: '', table: segments.at(-1) ?? '' }
  return { schema: segments.at(-2) ?? '', table: segments.at(-1) ?? '' }
}

function extractTableReferences(sqlQuery: string) {
  const references: string[] = []
  const regex = /\b(?:from|join)\s+([a-z0-9_.[\]"`]+)/gi
  let match = regex.exec(sqlQuery)
  while (match) {
    references.push(match[1])
    match = regex.exec(sqlQuery)
  }
  return references
}

function validateAllowedTableUsage(
  sqlQuery: string,
  allowedSchema: string,
  allowedTables: string[],
) {
  const normalizedSchema = normalizeSqlIdentifier(allowedSchema)

  if (!normalizedSchema) {
    throw new Error('DB_ALLOWED_SCHEMA está vacío o inválido.')
  }

  const allowedSet = new Set(allowedTables.map((t) => resolveBaseTableName(t)))
  const references = extractTableReferences(sqlQuery)

  if (!references.length) {
    throw new Error('La consulta debe incluir FROM/JOIN con esquema explícito.')
  }

  for (const reference of references) {
    const parsed = resolveSchemaAndTable(reference)

    if (!parsed.schema) {
      throw new Error(
        `Todas las referencias a tablas deben incluir esquema explícito. Sin esquema: ${reference}`,
      )
    }

    if (parsed.schema !== normalizedSchema) {
      throw new Error(
        `Solo se permite el esquema [${normalizedSchema}]. Detectado: [${parsed.schema}] en ${reference}.`,
      )
    }

    if (allowedSet.size > 0 && !allowedSet.has(parsed.table)) {
      throw new Error(
        `La tabla [${parsed.table}] no está en la lista de tablas permitidas (DB_ALLOWED_TABLES).`,
      )
    }
  }
}

function validateReadOnlySql(sqlQuery: string) {
  const normalized = sqlQuery.trim()
  const lower = normalized.toLowerCase()

  if (!(lower.startsWith('select') || lower.startsWith('with'))) {
    throw new Error('Solo se permiten consultas de lectura (SELECT / WITH).')
  }
  if (DANGEROUS_SQL_KEYWORDS.some((p) => p.test(lower))) {
    throw new Error('La consulta generada incluye comandos no permitidos para solo lectura.')
  }
  if (lower.includes('--') || lower.includes('/*') || lower.includes('*/')) {
    throw new Error('La consulta generada contiene comentarios SQL no permitidos.')
  }
  return normalized
}

function isInvalidObjectNameError(message: string) {
  return /invalid object name/i.test(message)
}

// ─── schema discovery ────────────────────────────────────────────────────────

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
      if (tableMap.size >= 50) continue
      tableMap.set(key, { schema, table, columns: [] })
    }
    const entry = tableMap.get(key)
    if (entry && entry.columns.length < 20 && !entry.columns.includes(column)) {
      entry.columns.push(column)
    }
  }

  const lines = Array.from(tableMap.values()).map(
    (e) => `- [${e.schema}].[${e.table}](${e.columns.join(', ')})`,
  )
  if (!lines.length) return ''
  return ['Columnas descubiertas en la base de datos:', ...lines].join('\n')
}

async function discoverSchemaHint(config: ProxyConfig) {
  const dbPoolConfig = resolveDbPoolConfig(config)
  const pool = new sql.ConnectionPool(dbPoolConfig)

  try {
    await pool.connect()
    const request = pool.request().input('allowedSchema', sql.NVarChar(256), config.dbAllowedSchema)

    let query: string
    if (config.dbAllowedTables.length > 0) {
      // Build trusted IN list from env-var values (not user input — safe to inline)
      const tableList = config.dbAllowedTables.map((t) => `'${t.replaceAll("'", "''")}'`).join(', ')
      query = `
        SELECT TOP (1200) TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE LOWER(TABLE_SCHEMA) = LOWER(@allowedSchema)
          AND LOWER(TABLE_NAME) IN (${tableList})
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `
    } else {
      query = `
        SELECT TOP (1200) TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE LOWER(TABLE_SCHEMA) = LOWER(@allowedSchema)
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `
    }

    const result = await request.query(query)
    return buildSchemaHintFromRows((result.recordset ?? []) as SchemaRow[])
  } catch {
    return ''
  } finally {
    await pool.close()
  }
}

// ─── SQL execution ───────────────────────────────────────────────────────────

async function executeSqlQuery(config: ProxyConfig, sqlQuery: string) {
  const dbPoolConfig = resolveDbPoolConfig(config)
  const target = resolveDbTarget(config)
  const pool = new sql.ConnectionPool(dbPoolConfig)

  try {
    await pool.connect()
    const request = pool.request()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`La consulta SQL excedió el timeout de ${config.dbTimeoutMs} ms.`)),
        config.dbTimeoutMs,
      )
    })
    const result = await Promise.race([request.query(sqlQuery), timeoutPromise])
    const records = (result.recordset ?? []) as QueryRow[]
    return records.slice(0, config.dbMaxRows)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido al consultar la base de datos.'
    if (/database was not found|insufficient permissions to connect to it|login failed/i.test(message)) {
      throw new Error(
        `${message} (target: server=${target.server}, database=${target.database}). ` +
          'Verifica que DB_DATABASE sea el nombre exacto de la base de datos y que el usuario tenga permisos de lectura.',
      )
    }
    throw new Error(`${message} (target: server=${target.server}, database=${target.database})`)
  } finally {
    await pool.close()
  }
}
async function executeSqlQueryCached(
  config: ProxyConfig,
  sqlQuery: string,
): Promise<{ rows: QueryRow[]; fromCache: boolean }> {
  const key = getCacheKey(sqlQuery)
  const cachedTs = queryCacheTimestamps.get(key)

  if (cachedTs !== undefined && Date.now() - cachedTs <= CACHE_TTL_MS) {
    return { rows: queryCache.get(key)!, fromCache: true }
  }

  queryCache.delete(key)
  queryCacheTimestamps.delete(key)

  const rows = await executeSqlQuery(config, sqlQuery)
  queryCache.set(key, rows)
  queryCacheTimestamps.set(key, Date.now())
  return { rows, fromCache: false }
}
// ─── SQL generation ──────────────────────────────────────────────────────────

function getLastUserQuestion(messages: Array<{ role: ChatRole; content: string }>) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content
  }
  throw new Error('No se encontró una pregunta del usuario para convertir a SQL.')
}

function unwrapCodeFence(value: string) {
  const fenced = /```(?:sql)?\s*([\s\S]*?)```/i.exec(value)
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
  if (!singleLine) throw new Error('La IA no devolvió SQL utilizable.')
  return singleLine.replace(/;\s*$/, '')
}

function buildAllowedTablesSection(schema: string, tables: string[]): string {
  if (tables.length > 0) {
    return tables.map((t) => `- [${schema}].[${t}]`).join('\n')
  }
  return `Cualquier tabla o vista del esquema [${schema}] con esquema explícito.`
}

async function generateSqlOrRoute(
  config: ProxyConfig,
  question: string,
  schemaHint: string,
  previousError?: string,
): Promise<SqlRouteResult> {
  const schema = config.dbAllowedSchema
  const tablesSection = buildAllowedTablesSection(schema, config.dbAllowedTables)

 
const systemPrompt = [
  // ── ROL ──
  `Eres un asistente experto en SQL T-SQL para SQL Server.

Tu única función es:
1. Determinar si la pregunta del usuario requiere consultar datos
2. Si SÍ → generar una consulta SQL válida
3. Si NO → responder EXACTAMENTE: CONVERSATIONAL`,

  // ── CLASIFICACIÓN ──
  `CLASIFICACIÓN DE INTENCIÓN:

Responde EXACTAMENTE "CONVERSATIONAL" si:
- Es un saludo (hola, buenos días, etc.)
- Es conversación general
- Preguntan qué puedes hacer
- Agradecimientos
- La pregunta es ambigua o incompleta (ej: "¿cómo voy?")
- No hay suficiente contexto para generar SQL correcto
- No se puede responder con los datos disponibles

En cualquier otro caso → genera SQL.`,

  // ── RESTRICCIONES ──
  `RESTRICCIONES ABSOLUTAS (SQL):
- SOLO SELECT o WITH ... SELECT
- PROHIBIDO:
  INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, EXEC, EXECUTE
- NO múltiples queries
- NO punto y coma al final
- NO markdown
- NO explicaciones
- Si no puedes construir un SQL correcto → responde CONVERSATIONAL`,

  // ── ESQUEMA ──
  `TABLAS Y VISTAS PERMITIDAS (esquema [${schema}]):
${tablesSection}

REGLAS DE USO:
- SIEMPRE usar esquema explícito: [${schema}].[tabla]
- Puedes hacer JOINs entre tablas
- Prioriza vistas analíticas (vw_)
- NUNCA usar tablas fuera del esquema
- NUNCA omitir el esquema`,

  // ── FORMATO ──
  `FORMATO DE SALIDA:
- Devuelve ÚNICAMENTE el SQL
- Sin texto adicional
- Sin comentarios (--)
- Sin bloques de código`,

  // ── BUENAS PRÁCTICAS ──
  `BUENAS PRÁCTICAS T-SQL:
- Usa TOP (N) si no piden dataset completo
- Usa SUM() para valores monetarios
- Usa GROUP BY cuando agregues datos
- Usa alias descriptivos en español

FILTROS:
- Periodo → campo "periodo" (formato: 'YYYY-MM' como texto)
- Si no se menciona año → usar el año actual: CAST(YEAR(GETDATE()) AS VARCHAR(4))
- Trimestres sobre campo periodo tipo 'YYYY-MM':
    Q1 → RIGHT(periodo,2) IN ('01','02','03')
    Q2 → RIGHT(periodo,2) IN ('04','05','06')
    Q3 → RIGHT(periodo,2) IN ('07','08','09')
    Q4 → RIGHT(periodo,2) IN ('10','11','12')
  Combinar con año: LEFT(periodo,4) = CAST(YEAR(GETDATE()) AS VARCHAR(4))
  Ejemplo Q1 año actual: WHERE LEFT(periodo,4) = CAST(YEAR(GETDATE()) AS VARCHAR(4)) AND RIGHT(periodo,2) IN ('01','02','03')
- Año → campo "anio" o "ejercicio" (si existe); si no, usar LEFT(periodo,4)

ANÁLISIS:
- Para ejecutado vs presupuesto → unir por:
  empresa_id, periodo, cuenta_id

CURVA S (acumulado progresivo — usar cuando pidan "curva s", "acumulado", "avance acumulado"):
- Requiere SUM() OVER (ORDER BY periodo ROWS UNBOUNDED PRECEDING) para cada métrica
- Para gráfico → tipo line con dos datasets (acumulado real vs acumulado presupuesto)`,

  // ── ESQUEMA DETALLADO ──
  schemaHint
    ? `ESQUEMA DETALLADO DE COLUMNAS:\n${schemaHint}`
    : '',

  // ── CONTEXTO NEGOCIO ──
  config.dbSchemaHint
    ? `CONTEXTO DE NEGOCIO:\n${config.dbSchemaHint}`
    : '',

  // ── ERROR ANTERIOR ──
  previousError
    ? `ERROR ANTERIOR (NO repetir):\n${previousError}`
    : '',
]
  .filter(Boolean)
  .join('\n\n')


  const raw = await completeWithAI(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    config.sqlModel,
  )

  const trimmed = raw.trim()

  // Detect conversational signal
  if (trimmed.toUpperCase() === 'CONVERSATIONAL' || /^conversational$/i.test(trimmed)) {
    return { type: 'conversational' }
  }

  const sqlCandidate = extractSqlCandidate(trimmed)
  const readOnlySql = validateReadOnlySql(sqlCandidate)
  validateAllowedTableUsage(readOnlySql, config.dbAllowedSchema, config.dbAllowedTables)
  return { type: 'sql', query: readOnlySql }
}

// ─── language & response helpers ─────────────────────────────────────────────

function resolveLanguage(value: unknown): Language {
  return value === 'en' ? 'en' : 'es'
}

function buildLanguageInstruction(language: Language) {
  return language === 'en'
    ? 'Respond exclusively in English, clearly and concisely.'
    : 'Responde exclusivamente en español de forma clara y concisa.'
}

function resolveModel(inputModel: unknown, defaultModel: string) {
  if (typeof inputModel === 'string' && inputModel.trim()) return inputModel.trim()
  return defaultModel
}

function summarizeRows(rows: QueryRow[]) {
  if (!rows.length) return '[]'
  return JSON.stringify(rows)
}

// ─── conversational prompt ───────────────────────────────────────────────────

function buildConversationalSystemPrompt(config: ProxyConfig, language: Language) {
  const isEN = language === 'en'
  const schema = config.dbAllowedSchema

  const availableReports = isEN
    ? `- **Income Statement (P&L)**: revenues, cost of sales, gross profit, operating income by period.
- **Balance Sheet**: current/non-current assets, current/non-current liabilities, equity.
- **Cash Flow**: operating, investing, and financing activities.
- **Budget vs Actual**: variance analysis (value and %) by account and cost center.
- **Financial KPIs**: gross margin %, operating margin %, current ratio, working capital, leverage ratio.
- **Accounts Receivable**: invoice aging, outstanding balances, overdue days by customer.
- **Accounts Payable**: pending supplier invoices, overdue amounts.
- **Sales**: by period, product, customer, sales rep — with revenue, costs, and gross margin.
- **Inventory**: balances, movements (entries/exits), valuation by product.
- **Financial Debt**: loans by entity, interest rate, outstanding balance, short/long term.
- **Taxes**: caused, paid, and pending by type.
- **Collections**: customer payment tracking linked to invoices.
- **Supplier Payments**: payment tracking linked to supplier invoices.
- **Bank Balances**: opening/closing balances and movements by bank account.`
    : `- **Estado de Resultados (PyG)**: ingresos, costo de ventas, utilidad bruta y operativa por periodo.
- **Balance General**: activos corrientes/no corrientes, pasivos, patrimonio.
- **Flujo de Caja**: flujo operativo, de inversión y de financiamiento.
- **Real vs Presupuesto**: análisis de variaciones (valor y %) por cuenta y centro de costo.
- **KPIs Financieros**: margen bruto %, margen operativo %, liquidez corriente, capital de trabajo, endeudamiento.
- **Cartera de Clientes**: antigüedad de cartera, saldos pendientes y días vencidos por cliente.
- **Cuentas por Pagar**: facturas de proveedores pendientes y vencidas.
- **Ventas**: por periodo, producto, cliente y vendedor — con ingresos, costos y margen bruto.
- **Inventarios**: saldos, movimientos (entradas/salidas) y valoración por producto.
- **Deuda Financiera**: créditos por entidad, tasa de interés, saldo de capital, corto y largo plazo.
- **Impuestos**: causados, pagados y pendientes por tipo.
- **Recaudos**: seguimiento de pagos recibidos de clientes vinculados a facturas.
- **Pagos a Proveedores**: seguimiento de pagos realizados vinculados a facturas.
- **Saldos Bancarios**: saldos iniciales, finales y movimientos por cuenta bancaria.`

  const instructions = isEN
    ? `You are FIBOT, a financial analysis assistant connected to a SQL Server database (schema: [${schema}]).

You can answer questions about financial data, generate reports, explain financial concepts, and guide users on what analyses are available.

AVAILABLE REPORTS AND ANALYSES:
${availableReports}

HOW TO INTERACT:
- For greetings and general questions: respond naturally and helpfully.
- For "what can you do?" questions: list the available reports clearly.
- For financial concept questions: explain them in simple terms with context.
- For data questions: let the user know you will query the database — they just need to ask naturally.

RESPONSE FORMAT:
- Use valid HTML. No markdown, no code blocks.
- Do NOT use heading tags (h1–h6). Use <strong> for emphasis.
- For lists: use <ul><li> structure.
- Keep responses concise and actionable.

${buildLanguageInstruction(language)}`
    : `Eres FIBOT, un asistente de análisis financiero conectado a una base de datos SQL Server (esquema: [${schema}]).

Puedes responder preguntas sobre datos financieros, generar reportes, explicar conceptos financieros y orientar a los usuarios sobre qué análisis están disponibles.

REPORTES Y ANÁLISIS DISPONIBLES:
${availableReports}

CÓMO INTERACTUAR:
- Para saludos y preguntas generales: responde de forma natural y amigable.
- Para "¿qué puedes hacer?": lista claramente los reportes disponibles.
- Para preguntas sobre conceptos financieros: explícalos en términos simples con contexto práctico.
- Para preguntas sobre datos: el usuario solo necesita preguntar en lenguaje natural y consultarás la base de datos automáticamente.

FORMATO DE RESPUESTA:
- Usa HTML válido. Sin markdown, sin bloques de código.
- NO uses etiquetas de encabezado (h1–h6). Usa <strong> para énfasis.
- Para listas: usa estructura <ul><li>.
- Mantén las respuestas concisas y accionables.

${buildLanguageInstruction(language)}`

  return instructions
}

// ─── answer generation ───────────────────────────────────────────────────────

function buildAnswerSystemPrompt(language: Language) {
  const isEN = language === 'en'

  const roleBlock = isEN
    ? `You are FIBOT, a financial data analyst. Answer ONLY based on the SQL query results provided.
Do not use external knowledge beyond what the data shows. If the data is insufficient, say so clearly.

CRITICAL: The data is already available in this message. You MUST generate the complete analysis RIGHT NOW in this response.
NEVER say things like "I am querying", "I will retrieve", "I am consulting the database", "as soon as I finish extracting", or any similar deferral. The query has already been executed and the results are below.`
    : `Eres FIBOT, un analista de datos financieros. Responde ÚNICAMENTE con base en los resultados de la consulta SQL entregada.
No uses conocimiento externo más allá de lo que muestran los datos. Si los datos son insuficientes, dilo claramente.

CRÍTICO: Los datos YA están disponibles en este mensaje. DEBES generar el análisis completo AHORA MISMO en esta respuesta.
NUNCA digas cosas como "estoy consultando", "voy a obtener", "estoy consultando la base de datos", "en cuanto termine la extracción", "te comparto el reporte" ni ninguna frase de aplazamiento. La consulta ya fue ejecutada y los resultados están a continuación.`

  const ebitdaBlock = isEN
    ? `EBITDA CALCULATION (apply only when asked):
  EBITDA = Revenues − Direct Costs − Other Costs & Expenses + Depreciation & Amortization
  - If any component is missing from the data, use 0 and flag it explicitly.
  - Always show the calculation step by step.`
    : `CÁLCULO DE EBITDA (aplica solo cuando se pregunte):
  EBITDA = Ingresos − Gastos directos − Otros costos y gastos + Depreciaciones y Amortizaciones
  - Si falta algún componente en los datos, usa 0 e indícalo explícitamente.
  - Presenta siempre el cálculo paso a paso.`

  const formatBlock = isEN
    ? `OUTPUT FORMAT (always apply):
- Respond exclusively in valid HTML. No markdown, no code blocks, no Mermaid.
- Do NOT use heading tags (h1–h6). Use <strong> for titles.
- Monetary values: format with thousand separators. E.g.: 1,250,000.
- For calculations/comparisons → HTML table: <th>Component</th><th>Value</th>
- For lists → <ul><li> structure.
- For single key values → <p><strong>Label:</strong> value</p>.`
    : `FORMATO DE SALIDA (aplica siempre):
- Responde exclusivamente en HTML válido. Sin markdown, sin bloques de código, sin Mermaid.
- NO uses etiquetas de encabezado (h1–h6). Usa <strong> para títulos.
- Valores monetarios: formatea con separadores de miles. Ej: 1.250.000.
- Para cálculos/comparaciones → tabla HTML: <th>Concepto</th><th>Valor</th>
- Para listas → estructura <ul><li>.
- Para valores clave únicos → <p><strong>Etiqueta:</strong> valor</p>.`

  const chartBlock = isEN
    ? `CHART RULES (apply when the user asks for a chart, graph, or visualization):

CRITICAL: You CAN generate charts. QuickChart is a URL-based service — you build a URL and it returns a chart image. No image file generation needed. NEVER say you cannot generate charts.

HOW IT WORKS:
1. Build a Chart.js JSON config object with the data.
2. URL-encode the entire JSON (encodeURIComponent style: spaces → %20, quotes → %22, etc.).
3. Embed it in: <img src="https://quickchart.io/chart?c=URL_ENCODED_CONFIG" style="width:80%;max-width:500px;">

ALLOWED TYPES: bar, pie, line
ALWAYS include the datalabels plugin to show values on each segment/bar.

EXAMPLE (bar chart — adapt labels and data to the actual query results):
Config before encoding:
{"type":"bar","data":{"labels":["Jan","Feb","Mar"],"datasets":[{"label":"Revenue","data":[120000,115000,135000],"backgroundColor":"rgba(54,162,235,0.7)"}]},"options":{"plugins":{"datalabels":{"anchor":"end","align":"top","color":"#333"}}}}

Final tag:
<img src="https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22Jan%22%2C%22Feb%22%2C%22Mar%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Revenue%22%2C%22data%22%3A%5B120000%2C115000%2C135000%5D%7D%5D%7D%7D" style="width:80%;max-width:500px;">

RULES:
- ONE <img> tag per response.
- Use REAL data from the query results — never invent numbers.
- No markdown, no backticks, no code blocks around the tag.`
    : `REGLAS DE GRÁFICOS (aplica cuando el usuario pida una gráfica, gráfico o visualización):

IMPORTANTE: SÍ PUEDES generar gráficos. QuickChart es un servicio basado en URL — construyes una URL y el servicio devuelve la imagen del gráfico. No se genera ningún archivo de imagen. NUNCA digas que no puedes generar gráficos.

CÓMO FUNCIONA:
1. Construye un objeto JSON de configuración Chart.js con los datos reales.
2. URL-encoda el JSON completo (estilo encodeURIComponent: espacios → %20, comillas → %22, etc.).
3. Incrústalo en: <img src="https://quickchart.io/chart?c=CONFIG_URL_ENCODED" style="width:80%;max-width:500px;">

TIPOS PERMITIDOS: bar, pie, line
SIEMPRE incluye el plugin datalabels para mostrar los valores en cada barra/segmento.

EJEMPLO (gráfico de barras — adapta etiquetas y datos a los resultados reales de la consulta):
Config antes de encodear:
{"type":"bar","data":{"labels":["Ene","Feb","Mar"],"datasets":[{"label":"Ingresos","data":[120000,115000,135000],"backgroundColor":"rgba(54,162,235,0.7)"}]},"options":{"plugins":{"datalabels":{"anchor":"end","align":"top","color":"#333"}}}}

Etiqueta final:
<img src="https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22Ene%22%2C%22Feb%22%2C%22Mar%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Ingresos%22%2C%22data%22%3A%5B120000%2C115000%2C135000%5D%7D%5D%7D%7D" style="width:80%;max-width:500px;">

REGLAS:
- UNA sola etiqueta <img> por respuesta.
- Usa los datos REALES de los resultados de la consulta — nunca inventes números.
- Sin markdown, sin backticks, sin bloques de código alrededor de la etiqueta.`

  return [roleBlock, ebitdaBlock, formatBlock, chartBlock, buildLanguageInstruction(language)]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

function buildAnswerUserPrompt(question: string, sqlQuery: string, rowsSummary: string) {
  return [
    `USER QUESTION: ${question}`,
    `EXECUTED SQL (already run — do NOT say you are about to run it):\n${sqlQuery}`,
    `QUERY RESULTS (JSON — data is already here, analyze it now):\n${rowsSummary}`,
    'The data above is complete. Generate the FULL final response RIGHT NOW following all system rules. Do NOT defer, do NOT say you are working on it.',
  ].join('\n\n')
}

/*async function answerWithData(
  config: ProxyConfig,
  question: string,
  sqlQuery: string,
  rows: QueryRow[],
  language: Language,
) {
  return completeWithAI(
    config,
    [
      { role: 'system', content: buildAnswerSystemPrompt(language) },
      { role: 'user', content: buildAnswerUserPrompt(question, sqlQuery, summarizeRows(rows)) },
    ],
    config.answerModel,
  )
}*/

async function answerWithDataEnhanced(
  config: ProxyConfig,
  question: string,
  sqlQuery: string,
  rows: QueryRow[],
  language: Language,
) {
  const kpis = detectKPIs(question)
  const isEN = language === 'en'

  const dashboardBlock = isEN
    ? `DASHBOARD FORMAT (apply to this response):
Structure your answer as an executive dashboard with:
1. Executive Summary (key insight in 1-2 sentences)
2. Key Metrics (table format)
3. Analysis (what the numbers mean in context)
4. Actionable Recommendation

KPIs detected: ${JSON.stringify(kpis)}`
    : `FORMATO DASHBOARD (aplica a esta respuesta):
Estructura tu respuesta como un dashboard ejecutivo con:
1. Resumen ejecutivo (insight clave en 1-2 oraciones)
2. Métricas principales (formato tabla)
3. Análisis (qué significan los números en contexto)
4. Recomendación accionable

KPIs detectados: ${JSON.stringify(kpis)}`

  const systemPrompt = [buildAnswerSystemPrompt(language), dashboardBlock].join('\n\n---\n\n')

  return completeWithAI(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildAnswerUserPrompt(question, sqlQuery, summarizeRows(rows)) },
    ],
    config.answerModel,
  )
}
// ─── flow handlers ───────────────────────────────────────────────────────────

function injectLanguageHint(
  messages: Array<{ role: ChatRole; content: string }>,
  language: Language,
): Array<{ role: ChatRole; content: string }> {
  return [{ role: 'system', content: buildLanguageInstruction(language) }, ...messages]
}

async function handleDirectChat(
  config: ProxyConfig,
  parsed: IncomingBody,
  messages: Array<{ role: ChatRole; content: string }>,
  language: Language,
) {
  const model = resolveModel(parsed.model, config.defaultModel)
  const message = await completeWithAI(config, injectLanguageHint(messages, language), model)
  return { message }
}

async function handleConversationalResponse(
  config: ProxyConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  language: Language,
) {
  const systemPrompt = buildConversationalSystemPrompt(config, language)
  const message = await completeWithAI(
    config,
    [{ role: 'system', content: systemPrompt }, ...messages],
    config.answerModel || config.defaultModel,
  )
  return { message }
}

/*async function handleDbAgentFlow(
  config: ProxyConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  language: Language,
) {
  const question = getLastUserQuestion(messages)
  const discoveredSchemaHint = await discoverSchemaHint(config)
  const baseSchemaHint = [config.dbSchemaHint, discoveredSchemaHint]
    .filter(Boolean)
    .join('\n\n')
    .trim()

  // Route: conversational vs SQL
  const route = await generateSqlOrRoute(config, question, baseSchemaHint)

  if (route.type === 'conversational') {
    return handleConversationalResponse(config, messages, language)
  }

  let sqlQuery = route.query
  let rows: QueryRow[] = []

  try {
    rows = await executeSqlQuery(config, sqlQuery)
  } catch (error) {
    const firstError =
      error instanceof Error ? error.message : 'Error desconocido al ejecutar SQL.'

    if (!isInvalidObjectNameError(firstError)) throw error

    // Retry once with fresh schema hint after invalid-object-name error
    const retryHint = await discoverSchemaHint(config)
    const mergedHint = [config.dbSchemaHint, retryHint].filter(Boolean).join('\n\n').trim()
    const retryRoute = await generateSqlOrRoute(config, question, mergedHint, firstError)

    if (retryRoute.type === 'conversational') {
      return handleConversationalResponse(config, messages, language)
    }

    sqlQuery = retryRoute.query
    rows = await executeSqlQuery(config, sqlQuery)
  }

  const message = await answerWithData(config, question, sqlQuery, rows, language)

  return {
    message,
    meta: { sql: sqlQuery, rows: rows.length, source: 'sql-db' },
  }
}*/

async function handleDbAgentFlow(
  config: ProxyConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  language: Language,
) {
  const sessionId = getSessionId(messages)
  const memory = getMemory(sessionId)

  let question = getLastUserQuestion(messages)
  question = enrichQuestionWithMemory(question, memory)

  const discoveredSchemaHint = await discoverSchemaHint(config)
  let route = await generateSqlOrRoute(config, question, discoveredSchemaHint)

  if (route.type === 'conversational') {
    return handleConversationalResponse(config, messages, language)
  }

  let sqlQuery = route.query
  let rows: QueryRow[]
  let fromCache: boolean

  try {
    ;({ rows, fromCache } = await executeSqlQueryCached(config, sqlQuery))
  } catch (error) {
    const firstError = error instanceof Error ? error.message : 'Error desconocido al ejecutar SQL.'

    if (!isInvalidObjectNameError(firstError)) throw error

    const retryHint = await discoverSchemaHint(config)
    const retryRoute = await generateSqlOrRoute(config, question, retryHint, firstError)

    if (retryRoute.type === 'conversational') {
      return handleConversationalResponse(config, messages, language)
    }

    sqlQuery = retryRoute.query
    ;({ rows, fromCache } = await executeSqlQueryCached(config, sqlQuery))
  }

  memory.lastQuery = question
  memory.lastResult = rows
  const detectedPeriod = extractPeriod(question)
  if (detectedPeriod) memory.lastPeriod = detectedPeriod

  const message = await answerWithDataEnhanced(config, question, sqlQuery, rows, language)

  return {
    message,
    meta: { sql: sqlQuery, rows: rows.length, cached: fromCache },
  }
}

// ─── Core request processor (platform-agnostic) ──────────────────────────────

async function processRequest(method: string, bodyText: string): Promise<LambdaResult> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim() || '*'
  const upperMethod = method.toUpperCase()

  if (upperMethod === 'OPTIONS') return jsonResponse(204, {}, allowedOrigin)
  if (upperMethod !== 'POST') return jsonResponse(405, { error: 'Método no permitido.' }, allowedOrigin)

  const config = getConfig()

  if (!config.apiUrl) {
    return jsonResponse(500, { error: 'Falta configurar AI_API_URL.' }, allowedOrigin)
  }

  try {
    const parsed = JSON.parse(bodyText || '{}') as IncomingBody
    const messages = resolveIncomingMessages(parsed)
    const language = resolveLanguage(parsed.language)

    const useDbFlow = Boolean(
      config.dbConnectionString || hasSqlAuthConfig(config) || hasServicePrincipalConfig(config),
    )

    const result = useDbFlow
      ? await handleDbAgentFlow(config, messages, language)
      : await handleDirectChat(config, parsed, messages, language)

    return jsonResponse(200, result, allowedOrigin)
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Error inesperado del proxy.'
    return jsonResponse(400, { error: safeMessage }, allowedOrigin)
  }
}

// ─── AWS Lambda adapter ───────────────────────────────────────────────────────

export async function handler(event: LambdaEvent): Promise<LambdaResult> {
  return processRequest(event.httpMethod ?? 'POST', event.body ?? '{}')
}

// ─── Azure Functions v4 adapter ───────────────────────────────────────────────
// Active when @azure/functions is present in node_modules (Azure runtime).
// Silently skipped on AWS Lambda where the package is not installed.

void (async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const azFn = require('@azure/functions') as {
      app: {
        http: (
          name: string,
          options: {
            methods: string[]
            authLevel: string
            route?: string
            handler: (req: { method: string; text: () => Promise<string> }) => Promise<{
              status: number
              headers: Record<string, string>
              body: string
            }>
          },
        ) => void
      }
    }

    azFn.app.http('fibotProxy', {
      methods: ['POST', 'OPTIONS'],
      authLevel: 'anonymous',
      route: 'chat',
      handler: async (req) => {
        const body = await req.text()
        const result = await processRequest(req.method, body)
        return { status: result.statusCode, headers: result.headers, body: result.body }
      },
    })
  } catch {
    // @azure/functions not installed — running in AWS Lambda mode
  }
})()
