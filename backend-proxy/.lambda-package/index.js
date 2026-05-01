"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const mssql_1 = __importDefault(require("mssql"));
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
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
];
// ─── helpers ────────────────────────────────────────────────────────────────
function resolveProvider() {
    const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
    if (configured === 'gemini')
        return 'gemini';
    return 'openai-compatible';
}
function parsePositiveInt(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return parsed;
}
function parseAllowedTables(multiTable, singleTable) {
    if (multiTable) {
        return multiTable
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
    }
    if (singleTable)
        return [singleTable.trim().toLowerCase()];
    return [];
}
function jsonResponse(statusCode, body, allowedOrigin) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify(body),
    };
}
// ─── config ─────────────────────────────────────────────────────────────────
function getConfig() {
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
        dbAllowedTables: parseAllowedTables(process.env.DB_ALLOWED_TABLES?.trim() ?? '', process.env.DB_ALLOWED_TABLE?.trim() ?? ''),
        dbSchemaHint: process.env.DB_SCHEMA_HINT?.trim() ?? '',
        dbMaxRows: parsePositiveInt(process.env.DB_MAX_ROWS, 100),
        dbTimeoutMs: parsePositiveInt(process.env.DB_TIMEOUT_SECONDS, 30) * 1000,
    };
}
// ─── input sanitization ─────────────────────────────────────────────────────
function sanitizeMessages(value) {
    if (!Array.isArray(value))
        throw new TypeError('messages debe ser un arreglo.');
    const sanitized = value
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
        const role = item.role;
        const content = item.content;
        if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
            throw new TypeError('Cada mensaje debe incluir un role válido.');
        }
        if (typeof content !== 'string' || !content.trim()) {
            throw new TypeError('Cada mensaje debe incluir content no vacío.');
        }
        return { role: role, content: content.trim() };
    });
    if (!sanitized.length)
        throw new TypeError('Debe enviarse al menos un mensaje.');
    return sanitized;
}
function sanitizeGeminiContents(value) {
    if (!Array.isArray(value))
        throw new TypeError('contents debe ser un arreglo.');
    const normalized = value
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
        const role = item.role;
        const firstPart = Array.isArray(item.parts) ? item.parts[0] : undefined;
        const text = firstPart?.text;
        if (typeof role !== 'string' || (role !== 'user' && role !== 'model')) {
            throw new TypeError('Cada item en contents debe incluir role user o model.');
        }
        if (typeof text !== 'string' || !text.trim()) {
            throw new TypeError('Cada item en contents debe incluir parts[0].text no vacío.');
        }
        return {
            role: role === 'model' ? 'assistant' : 'user',
            content: text.trim(),
        };
    });
    if (!normalized.length)
        throw new TypeError('Debe enviarse al menos un elemento en contents.');
    return normalized;
}
function resolveIncomingMessages(parsed) {
    if (Array.isArray(parsed.messages))
        return sanitizeMessages(parsed.messages);
    if (Array.isArray(parsed.contents))
        return sanitizeGeminiContents(parsed.contents);
    throw new TypeError('Debes enviar messages o contents en el body.');
}
// ─── AI provider layer ──────────────────────────────────────────────────────
function resolveAssistantText(payload) {
    if (payload.content?.trim())
        return payload.content.trim();
    if (payload.message?.trim())
        return payload.message.trim();
    if (payload.output_text?.trim())
        return payload.output_text.trim();
    const choiceText = payload.choices?.[0]?.message?.content?.trim();
    if (choiceText)
        return choiceText;
    const geminiText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (geminiText)
        return geminiText;
    throw new Error('El proveedor IA no devolvió contenido legible.');
}
function mapMessagesForGemini(messages) {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const contents = conversationMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
    return {
        ...(systemMessages.length
            ? { systemInstruction: { parts: [{ text: systemMessages.map((m) => m.content).join('\n') }] } }
            : {}),
        contents,
    };
}
function buildRequestBody(provider, messages, model) {
    if (provider === 'gemini') {
        return { ...mapMessagesForGemini(messages), ...(model ? { model } : {}) };
    }
    return { messages, ...(model ? { model } : {}) };
}
function buildHeaders(provider, authHeader, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (!apiKey)
        return headers;
    if (provider === 'gemini') {
        headers[authHeader] = apiKey;
        return headers;
    }
    headers[authHeader] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    return headers;
}
async function requestUpstream(apiUrl, headers, body) {
    return fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
}
async function getUpstreamErrorDetail(response) {
    try {
        const payload = (await response.json());
        const message = payload.error?.message?.trim();
        const status = payload.error?.status?.trim();
        if (message && status)
            return `${status}: ${message}`;
        if (message)
            return message;
    }
    catch {
        // fall through
    }
    return `El proveedor IA respondió con estado ${response.status}.`;
}
async function completeWithAI(config, messages, model) {
    if (!config.apiUrl)
        throw new Error('Falta configurar AI_API_URL.');
    const requestBody = buildRequestBody(config.provider, messages, model);
    const headers = buildHeaders(config.provider, config.authHeader, config.apiKey);
    const upstreamResponse = await requestUpstream(config.apiUrl, headers, requestBody);
    if (!upstreamResponse.ok) {
        const detail = await getUpstreamErrorDetail(upstreamResponse);
        const hint = upstreamResponse.status === 429
            ? 'Revisa cuotas/rate limits en Gemini y confirma billing habilitado.'
            : undefined;
        throw new Error(hint ? `${detail} ${hint}` : detail);
    }
    const payload = (await upstreamResponse.json());
    return resolveAssistantText(payload);
}
// ─── DB connection ──────────────────────────────────────────────────────────
function normalizeDbServer(server) {
    const trimmed = server.trim();
    if (!trimmed)
        return '';
    const noProtocol = trimmed.replace(/^tcp:/i, '').replace(/^https?:\/\//i, '');
    const noPort = noProtocol.replace(/,\d+$/, '').replace(/:\d+$/, '');
    return noPort.replace(/\/$/, '');
}
function hasSqlAuthConfig(config) {
    return Boolean(config.dbServer && config.dbDatabase && config.dbUser && config.dbPassword);
}
function hasServicePrincipalConfig(config) {
    return Boolean(config.dbServer &&
        config.dbDatabase &&
        config.azureTenantId &&
        config.azureClientId &&
        config.azureClientSecret);
}
function resolveDbPoolConfig(config) {
    if (config.dbConnectionString)
        return config.dbConnectionString;
    if (hasSqlAuthConfig(config)) {
        return {
            server: normalizeDbServer(config.dbServer),
            database: config.dbDatabase,
            port: 1433,
            user: config.dbUser,
            password: config.dbPassword,
            options: { encrypt: true, trustServerCertificate: false },
        };
    }
    if (hasServicePrincipalConfig(config)) {
        return {
            server: normalizeDbServer(config.dbServer),
            database: config.dbDatabase,
            port: 1433,
            options: { encrypt: true, trustServerCertificate: false },
            authentication: {
                type: 'azure-active-directory-service-principal-secret',
                options: {
                    tenantId: config.azureTenantId,
                    clientId: config.azureClientId,
                    clientSecret: config.azureClientSecret,
                },
            },
        };
    }
    throw new Error('Falta configuración de base de datos. Define DB_CONNECTION_STRING, o bien ' +
        'DB_SERVER + DB_DATABASE + DB_USER + DB_PASSWORD (SQL auth), o ' +
        'DB_SERVER + DB_DATABASE + AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET (Service Principal).');
}
function resolveDbTarget(config) {
    if (config.dbConnectionString) {
        const serverMatch = /(?:^|;)\s*(?:server|data source)\s*=\s*([^;]+)/i.exec(config.dbConnectionString);
        const databaseMatch = /(?:^|;)\s*(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(config.dbConnectionString);
        return {
            server: serverMatch?.[1]?.trim() ?? '(server-no-detectado)',
            database: databaseMatch?.[1]?.trim() ?? '(database-no-detectada)',
        };
    }
    return { server: normalizeDbServer(config.dbServer), database: config.dbDatabase };
}
// ─── SQL validation ──────────────────────────────────────────────────────────
function normalizeSqlIdentifier(identifier) {
    return identifier.replaceAll(/[[\]"`]/g, '').trim().toLowerCase();
}
function resolveBaseTableName(identifier) {
    const normalized = normalizeSqlIdentifier(identifier);
    return normalized.split('.').filter(Boolean).at(-1) ?? '';
}
function resolveSchemaAndTable(identifier) {
    const segments = normalizeSqlIdentifier(identifier).split('.').filter(Boolean);
    if (segments.length < 2)
        return { schema: '', table: segments.at(-1) ?? '' };
    return { schema: segments.at(-2) ?? '', table: segments.at(-1) ?? '' };
}
function extractTableReferences(sqlQuery) {
    const references = [];
    const regex = /\b(?:from|join)\s+([a-z0-9_.[\]"`]+)/gi;
    let match = regex.exec(sqlQuery);
    while (match) {
        references.push(match[1]);
        match = regex.exec(sqlQuery);
    }
    return references;
}
function validateAllowedTableUsage(sqlQuery, allowedSchema, allowedTables) {
    const normalizedSchema = normalizeSqlIdentifier(allowedSchema);
    if (!normalizedSchema) {
        throw new Error('DB_ALLOWED_SCHEMA está vacío o inválido.');
    }
    const allowedSet = new Set(allowedTables.map((t) => resolveBaseTableName(t)));
    const references = extractTableReferences(sqlQuery);
    if (!references.length) {
        throw new Error('La consulta debe incluir FROM/JOIN con esquema explícito.');
    }
    for (const reference of references) {
        const parsed = resolveSchemaAndTable(reference);
        if (!parsed.schema) {
            throw new Error(`Todas las referencias a tablas deben incluir esquema explícito. Sin esquema: ${reference}`);
        }
        if (parsed.schema !== normalizedSchema) {
            throw new Error(`Solo se permite el esquema [${normalizedSchema}]. Detectado: [${parsed.schema}] en ${reference}.`);
        }
        if (allowedSet.size > 0 && !allowedSet.has(parsed.table)) {
            throw new Error(`La tabla [${parsed.table}] no está en la lista de tablas permitidas (DB_ALLOWED_TABLES).`);
        }
    }
}
function validateReadOnlySql(sqlQuery) {
    const normalized = sqlQuery.trim();
    const lower = normalized.toLowerCase();
    if (!(lower.startsWith('select') || lower.startsWith('with'))) {
        throw new Error('Solo se permiten consultas de lectura (SELECT / WITH).');
    }
    if (DANGEROUS_SQL_KEYWORDS.some((p) => p.test(lower))) {
        throw new Error('La consulta generada incluye comandos no permitidos para solo lectura.');
    }
    if (lower.includes('--') || lower.includes('/*') || lower.includes('*/')) {
        throw new Error('La consulta generada contiene comentarios SQL no permitidos.');
    }
    return normalized;
}
function isInvalidObjectNameError(message) {
    return /invalid object name/i.test(message);
}
// ─── schema discovery ────────────────────────────────────────────────────────
function buildSchemaHintFromRows(rows) {
    if (!rows.length)
        return '';
    const tableMap = new Map();
    for (const row of rows) {
        const schema = row.TABLE_SCHEMA?.trim();
        const table = row.TABLE_NAME?.trim();
        const column = row.COLUMN_NAME?.trim();
        if (!schema || !table || !column)
            continue;
        const key = `${schema}.${table}`;
        if (!tableMap.has(key)) {
            if (tableMap.size >= 50)
                continue;
            tableMap.set(key, { schema, table, columns: [] });
        }
        const entry = tableMap.get(key);
        if (entry && entry.columns.length < 20 && !entry.columns.includes(column)) {
            entry.columns.push(column);
        }
    }
    const lines = Array.from(tableMap.values()).map((e) => `- [${e.schema}].[${e.table}](${e.columns.join(', ')})`);
    if (!lines.length)
        return '';
    return ['Columnas descubiertas en la base de datos:', ...lines].join('\n');
}
async function discoverSchemaHint(config) {
    const dbPoolConfig = resolveDbPoolConfig(config);
    const pool = new mssql_1.default.ConnectionPool(dbPoolConfig);
    try {
        await pool.connect();
        const request = pool.request().input('allowedSchema', mssql_1.default.NVarChar(256), config.dbAllowedSchema);
        let query;
        if (config.dbAllowedTables.length > 0) {
            // Build trusted IN list from env-var values (not user input — safe to inline)
            const tableList = config.dbAllowedTables.map((t) => `'${t.replaceAll("'", "''")}'`).join(', ');
            query = `
        SELECT TOP (1200) TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE LOWER(TABLE_SCHEMA) = LOWER(@allowedSchema)
          AND LOWER(TABLE_NAME) IN (${tableList})
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `;
        }
        else {
            query = `
        SELECT TOP (1200) TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE LOWER(TABLE_SCHEMA) = LOWER(@allowedSchema)
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `;
        }
        const result = await request.query(query);
        return buildSchemaHintFromRows((result.recordset ?? []));
    }
    catch {
        return '';
    }
    finally {
        await pool.close();
    }
}
// ─── SQL execution ───────────────────────────────────────────────────────────
async function executeSqlQuery(config, sqlQuery) {
    const dbPoolConfig = resolveDbPoolConfig(config);
    const target = resolveDbTarget(config);
    const pool = new mssql_1.default.ConnectionPool(dbPoolConfig);
    try {
        await pool.connect();
        const request = pool.request();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`La consulta SQL excedió el timeout de ${config.dbTimeoutMs} ms.`)), config.dbTimeoutMs);
        });
        const result = await Promise.race([request.query(sqlQuery), timeoutPromise]);
        const records = (result.recordset ?? []);
        return records.slice(0, config.dbMaxRows);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido al consultar la base de datos.';
        if (/database was not found|insufficient permissions to connect to it|login failed/i.test(message)) {
            throw new Error(`${message} (target: server=${target.server}, database=${target.database}). ` +
                'Verifica que DB_DATABASE sea el nombre exacto de la base de datos y que el usuario tenga permisos de lectura.');
        }
        throw new Error(`${message} (target: server=${target.server}, database=${target.database})`);
    }
    finally {
        await pool.close();
    }
}
// ─── SQL generation ──────────────────────────────────────────────────────────
function getLastUserQuestion(messages) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user')
            return messages[i].content;
    }
    throw new Error('No se encontró una pregunta del usuario para convertir a SQL.');
}
function unwrapCodeFence(value) {
    const fenced = /```(?:sql)?\s*([\s\S]*?)```/i.exec(value);
    if (fenced?.[1])
        return fenced[1].trim();
    return value.trim();
}
function extractSqlCandidate(raw) {
    const unwrapped = unwrapCodeFence(raw);
    const singleLine = unwrapped
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ');
    if (!singleLine)
        throw new Error('La IA no devolvió SQL utilizable.');
    return singleLine.replace(/;\s*$/, '');
}
function buildAllowedTablesSection(schema, tables) {
    if (tables.length > 0) {
        return tables.map((t) => `- [${schema}].[${t}]`).join('\n');
    }
    return `Cualquier tabla o vista del esquema [${schema}] con esquema explícito.`;
}
async function generateSqlOrRoute(config, question, schemaHint, previousError) {
    const schema = config.dbAllowedSchema;
    const tablesSection = buildAllowedTablesSection(schema, config.dbAllowedTables);
    const systemPrompt = [
        // ── ROL ──
        `Eres un asistente experto en SQL T-SQL para SQL Server.
Tu función principal es convertir preguntas de negocio sobre datos financieros en consultas SQL de solo lectura.

CASO ESPECIAL — RESPUESTA CONVERSACIONAL:
Si la pregunta es un saludo, agradecimiento, pregunta sobre tus capacidades, o cualquier consulta que NO requiera datos de la base de datos, responde ÚNICAMENTE con la palabra:
CONVERSATIONAL
(sin explicaciones, sin SQL, solo esa palabra)`,
        // ── RESTRICCIONES ──
        `RESTRICCIONES ABSOLUTAS (cuando generes SQL):
- Solo sentencias SELECT o WITH ... SELECT.
- Prohibido: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, EXEC, EXECUTE.
- Prohibido generar múltiples sentencias separadas por punto y coma.
- Solo tablas/vistas del esquema [${schema}] con esquema explícito siempre.
- Si la pregunta no puede responderse con datos disponibles, responde: CONVERSATIONAL`,
        // ── TABLAS PERMITIDAS ──
        `TABLAS Y VISTAS PERMITIDAS (esquema [${schema}]):
${tablesSection}

REGLAS DE USO:
- Siempre califica con esquema. Ejemplo: FROM [${schema}].[nombre_tabla]
- Puedes hacer JOINs entre tablas del mismo esquema.
- Usa las vistas analíticas cuando estén disponibles (empiezan con vw_).
- Nunca uses referencias sin esquema explícito.`,
        // ── FORMATO ──
        `FORMATO DE SALIDA (cuando generes SQL):
- Devuelve ÚNICAMENTE el SQL, sin explicaciones, sin markdown, sin bloques de código.
- No incluyas comentarios (--) ni texto fuera del SQL.
- No uses punto y coma al final.`,
        // ── REGLAS T-SQL ──
        `BUENAS PRÁCTICAS T-SQL:
- Usa TOP (N) para limitar resultados cuando no se pida un total.
- Para filtrar por periodo usa el campo "periodo" (formato: '2025-01').
- Para filtrar por año usa "anio" o "ejercicio" según la tabla.
- Para comparar ejecutado vs presupuesto: une la tabla de hechos real con la de presupuesto por empresa_id, periodo y cuenta_id.
- Usa SUM() para agregar valores monetarios; GROUP BY para desglosar por categoría o periodo.
- Usa alias descriptivos en español para columnas calculadas.`,
        // ── ESQUEMA DESCUBIERTO ──
        schemaHint
            ? `ESQUEMA DETALLADO DE COLUMNAS (descubierto automáticamente):\n${schemaHint}`
            : '',
        // ── CONTEXTO ADICIONAL DEL NEGOCIO ──
        config.dbSchemaHint
            ? `CONTEXTO DE NEGOCIO (proporcionado por el administrador):\n${config.dbSchemaHint}`
            : '',
        // ── ERROR ANTERIOR ──
        previousError
            ? `AVISO — ERROR EN CONSULTA ANTERIOR (evita repetir este patrón):\n${previousError}`
            : '',
    ]
        .filter(Boolean)
        .join('\n\n');
    const raw = await completeWithAI(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
    ], config.sqlModel);
    const trimmed = raw.trim();
    // Detect conversational signal
    if (trimmed.toUpperCase() === 'CONVERSATIONAL' || /^conversational$/i.test(trimmed)) {
        return { type: 'conversational' };
    }
    const sqlCandidate = extractSqlCandidate(trimmed);
    const readOnlySql = validateReadOnlySql(sqlCandidate);
    validateAllowedTableUsage(readOnlySql, config.dbAllowedSchema, config.dbAllowedTables);
    return { type: 'sql', query: readOnlySql };
}
// ─── language & response helpers ─────────────────────────────────────────────
function resolveLanguage(value) {
    return value === 'en' ? 'en' : 'es';
}
function buildLanguageInstruction(language) {
    return language === 'en'
        ? 'Respond exclusively in English, clearly and concisely.'
        : 'Responde exclusivamente en español de forma clara y concisa.';
}
function resolveModel(inputModel, defaultModel) {
    if (typeof inputModel === 'string' && inputModel.trim())
        return inputModel.trim();
    return defaultModel;
}
function summarizeRows(rows) {
    if (!rows.length)
        return '[]';
    return JSON.stringify(rows);
}
// ─── conversational prompt ───────────────────────────────────────────────────
function buildConversationalSystemPrompt(config, language) {
    const isEN = language === 'en';
    const schema = config.dbAllowedSchema;
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
- **Saldos Bancarios**: saldos iniciales, finales y movimientos por cuenta bancaria.`;
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

${buildLanguageInstruction(language)}`;
    return instructions;
}
// ─── answer generation ───────────────────────────────────────────────────────
function buildAnswerSystemPrompt(language) {
    const isEN = language === 'en';
    const roleBlock = isEN
        ? `You are FIBOT, a financial data analyst. Answer ONLY based on the SQL query results provided.
Do not use external knowledge beyond what the data shows. If the data is insufficient, say so clearly.`
        : `Eres FIBOT, un analista de datos financieros. Responde ÚNICAMENTE con base en los resultados de la consulta SQL entregada.
No uses conocimiento externo más allá de lo que muestran los datos. Si los datos son insuficientes, dilo claramente.`;
    const ebitdaBlock = isEN
        ? `EBITDA CALCULATION (apply only when asked):
  EBITDA = Revenues − Direct Costs − Other Costs & Expenses + Depreciation & Amortization
  - If any component is missing from the data, use 0 and flag it explicitly.
  - Always show the calculation step by step.`
        : `CÁLCULO DE EBITDA (aplica solo cuando se pregunte):
  EBITDA = Ingresos − Gastos directos − Otros costos y gastos + Depreciaciones y Amortizaciones
  - Si falta algún componente en los datos, usa 0 e indícalo explícitamente.
  - Presenta siempre el cálculo paso a paso.`;
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
- Para valores clave únicos → <p><strong>Etiqueta:</strong> valor</p>.`;
    const chartBlock = isEN
        ? `CHART RULES (only when explicitly requested by the user):
- Use QuickChart (quickchart.io) only. Allowed types: bar, pie, line.
- Include exactly ONE <img> tag with src from quickchart.io.
- Style: style="width:80%; max-width:500px;"
- Always include the datalabels plugin to show values on each bar/segment.
- URL-encode the config. No backticks or markdown.`
        : `REGLAS DE GRÁFICOS (solo cuando el usuario lo solicite explícitamente):
- Usa únicamente QuickChart (quickchart.io). Tipos: bar, pie, line.
- Incluye exactamente UNA etiqueta <img> con src de quickchart.io.
- Estilo: style="width:80%; max-width:500px;"
- Siempre incluye el plugin datalabels para mostrar valores en cada barra/segmento.
- Codifica la URL del config. Sin backticks ni markdown.`;
    return [roleBlock, ebitdaBlock, formatBlock, chartBlock, buildLanguageInstruction(language)]
        .filter(Boolean)
        .join('\n\n---\n\n');
}
function buildAnswerUserPrompt(question, sqlQuery, rowsSummary) {
    return [
        `USER QUESTION: ${question}`,
        `EXECUTED SQL:\n${sqlQuery}`,
        `QUERY RESULTS (JSON):\n${rowsSummary}`,
        'Generate the final response following all system rules.',
    ].join('\n\n');
}
async function answerWithData(config, question, sqlQuery, rows, language) {
    return completeWithAI(config, [
        { role: 'system', content: buildAnswerSystemPrompt(language) },
        { role: 'user', content: buildAnswerUserPrompt(question, sqlQuery, summarizeRows(rows)) },
    ], config.answerModel);
}
// ─── flow handlers ───────────────────────────────────────────────────────────
function injectLanguageHint(messages, language) {
    return [{ role: 'system', content: buildLanguageInstruction(language) }, ...messages];
}
async function handleDirectChat(config, parsed, messages, language) {
    const model = resolveModel(parsed.model, config.defaultModel);
    const message = await completeWithAI(config, injectLanguageHint(messages, language), model);
    return { message };
}
async function handleConversationalResponse(config, messages, language) {
    const systemPrompt = buildConversationalSystemPrompt(config, language);
    const message = await completeWithAI(config, [{ role: 'system', content: systemPrompt }, ...messages], config.answerModel || config.defaultModel);
    return { message };
}
async function handleDbAgentFlow(config, messages, language) {
    const question = getLastUserQuestion(messages);
    const discoveredSchemaHint = await discoverSchemaHint(config);
    const baseSchemaHint = [config.dbSchemaHint, discoveredSchemaHint]
        .filter(Boolean)
        .join('\n\n')
        .trim();
    // Route: conversational vs SQL
    const route = await generateSqlOrRoute(config, question, baseSchemaHint);
    if (route.type === 'conversational') {
        return handleConversationalResponse(config, messages, language);
    }
    let sqlQuery = route.query;
    let rows = [];
    try {
        rows = await executeSqlQuery(config, sqlQuery);
    }
    catch (error) {
        const firstError = error instanceof Error ? error.message : 'Error desconocido al ejecutar SQL.';
        if (!isInvalidObjectNameError(firstError))
            throw error;
        // Retry once with fresh schema hint after invalid-object-name error
        const retryHint = await discoverSchemaHint(config);
        const mergedHint = [config.dbSchemaHint, retryHint].filter(Boolean).join('\n\n').trim();
        const retryRoute = await generateSqlOrRoute(config, question, mergedHint, firstError);
        if (retryRoute.type === 'conversational') {
            return handleConversationalResponse(config, messages, language);
        }
        sqlQuery = retryRoute.query;
        rows = await executeSqlQuery(config, sqlQuery);
    }
    const message = await answerWithData(config, question, sqlQuery, rows, language);
    return {
        message,
        meta: { sql: sqlQuery, rows: rows.length, source: 'sql-db' },
    };
}
// ─── Lambda handler ──────────────────────────────────────────────────────────
async function handler(event) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim() || '*';
    const method = event.httpMethod ?? 'POST';
    if (method === 'OPTIONS')
        return jsonResponse(204, {}, allowedOrigin);
    if (method !== 'POST')
        return jsonResponse(405, { error: 'Método no permitido.' }, allowedOrigin);
    const config = getConfig();
    if (!config.apiUrl) {
        return jsonResponse(500, { error: 'Falta configurar AI_API_URL.' }, allowedOrigin);
    }
    try {
        const parsed = JSON.parse(event.body ?? '{}');
        const messages = resolveIncomingMessages(parsed);
        const language = resolveLanguage(parsed.language);
        const useDbFlow = Boolean(config.dbConnectionString || hasSqlAuthConfig(config) || hasServicePrincipalConfig(config));
        if (!useDbFlow) {
            return jsonResponse(200, await handleDirectChat(config, parsed, messages, language), allowedOrigin);
        }
        return jsonResponse(200, await handleDbAgentFlow(config, messages, language), allowedOrigin);
    }
    catch (error) {
        const safeMessage = error instanceof Error ? error.message : 'Error inesperado del proxy.';
        return jsonResponse(400, { error: safeMessage }, allowedOrigin);
    }
}
