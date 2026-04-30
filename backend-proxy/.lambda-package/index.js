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
function resolveProvider() {
    const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
    if (configured === 'gemini')
        return 'gemini';
    return 'openai-compatible';
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
function sanitizeMessages(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('messages debe ser un arreglo.');
    }
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
        return {
            role: role,
            content: content.trim(),
        };
    });
    if (!sanitized.length) {
        throw new TypeError('Debe enviarse al menos un mensaje.');
    }
    return sanitized;
}
function sanitizeGeminiContents(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('contents debe ser un arreglo.');
    }
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
    if (!normalized.length) {
        throw new TypeError('Debe enviarse al menos un elemento en contents.');
    }
    return normalized;
}
function resolveIncomingMessages(parsed) {
    if (Array.isArray(parsed.messages)) {
        return sanitizeMessages(parsed.messages);
    }
    if (Array.isArray(parsed.contents)) {
        return sanitizeGeminiContents(parsed.contents);
    }
    throw new TypeError('Debes enviar messages o contents en el body.');
}
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
    const systemMessages = messages.filter((message) => message.role === 'system');
    const conversationMessages = messages.filter((message) => message.role !== 'system');
    const contents = conversationMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
    }));
    return {
        ...(systemMessages.length
            ? {
                systemInstruction: {
                    parts: [{ text: systemMessages.map((message) => message.content).join('\n') }],
                },
            }
            : {}),
        contents,
    };
}
function parsePositiveInt(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return parsed;
}
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
        dbAllowedTable: process.env.DB_ALLOWED_TABLE?.trim() ?? 'fact_presupuesto_gold',
        dbSchemaHint: process.env.DB_SCHEMA_HINT?.trim() ?? '',
        dbMaxRows: parsePositiveInt(process.env.DB_MAX_ROWS, 100),
        dbTimeoutMs: parsePositiveInt(process.env.DB_TIMEOUT_SECONDS, 30) * 1000,
    };
}
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
    if (config.dbConnectionString) {
        return config.dbConnectionString;
    }
    if (hasSqlAuthConfig(config)) {
        return {
            server: normalizeDbServer(config.dbServer),
            database: config.dbDatabase,
            port: 1433,
            user: config.dbUser,
            password: config.dbPassword,
            options: {
                encrypt: true,
                trustServerCertificate: false,
            },
        };
    }
    if (hasServicePrincipalConfig(config)) {
        return {
            server: normalizeDbServer(config.dbServer),
            database: config.dbDatabase,
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
        };
    }
    throw new Error('Falta configuración de base de datos. Define DB_CONNECTION_STRING, o bien DB_SERVER + DB_DATABASE + DB_USER + DB_PASSWORD (SQL auth), o DB_SERVER + DB_DATABASE + AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET (Service Principal).');
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
    return {
        server: normalizeDbServer(config.dbServer),
        database: config.dbDatabase,
    };
}
function isInvalidObjectNameError(message) {
    return /invalid object name/i.test(message);
}
function normalizeSqlIdentifier(identifier) {
    return identifier.replaceAll(/[[\]"`]/g, '').trim().toLowerCase();
}
function resolveBaseTableName(identifier) {
    const normalized = normalizeSqlIdentifier(identifier);
    const segments = normalized.split('.').filter(Boolean);
    return segments.at(-1) ?? '';
}
function resolveSchemaAndTable(identifier) {
    const normalized = normalizeSqlIdentifier(identifier);
    const segments = normalized.split('.').filter(Boolean);
    if (segments.length < 2) {
        return {
            schema: '',
            table: segments.at(-1) ?? '',
        };
    }
    return {
        schema: segments.at(-2) ?? '',
        table: segments.at(-1) ?? '',
    };
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
function validateAllowedTableUsage(sqlQuery, allowedSchema, allowedTable) {
    const normalizedAllowedSchema = normalizeSqlIdentifier(allowedSchema);
    const normalizedAllowedTable = resolveBaseTableName(allowedTable);
    if (!normalizedAllowedSchema || !normalizedAllowedTable) {
        throw new Error('DB_ALLOWED_TABLE está vacío o inválido.');
    }
    const references = extractTableReferences(sqlQuery);
    if (!references.length) {
        throw new Error('La consulta debe incluir FROM/JOIN sobre la tabla permitida con esquema explícito.');
    }
    const invalidReference = references.find((reference) => {
        const parsed = resolveSchemaAndTable(reference);
        return parsed.schema !== normalizedAllowedSchema || parsed.table !== normalizedAllowedTable;
    });
    if (invalidReference) {
        throw new Error(`La consulta solo puede usar [${normalizedAllowedSchema}].[${normalizedAllowedTable}]. Se detectó referencia no permitida: ${invalidReference}.`);
    }
}
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
            if (tableMap.size >= 30)
                continue;
            tableMap.set(key, {
                schema,
                table,
                columns: [],
            });
        }
        const tableEntry = tableMap.get(key);
        if (tableEntry && tableEntry.columns.length < 12 && !tableEntry.columns.includes(column)) {
            tableEntry.columns.push(column);
        }
    }
    const lines = Array.from(tableMap.values()).map((entry) => `- [${entry.schema}].[${entry.table}](${entry.columns.join(', ')})`);
    if (!lines.length)
        return '';
    return ['Tablas disponibles en la base de datos (usa solo estas):', ...lines].join('\n');
}
async function discoverSchemaHint(config) {
    const dbPoolConfig = resolveDbPoolConfig(config);
    const pool = new mssql_1.default.ConnectionPool(dbPoolConfig);
    try {
        await pool.connect();
        const result = await pool
            .request()
            .input('allowedSchema', mssql_1.default.NVarChar(256), config.dbAllowedSchema)
            .input('allowedTable', mssql_1.default.NVarChar(256), config.dbAllowedTable)
            .query(`
      SELECT TOP (800)
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE LOWER(TABLE_SCHEMA) = LOWER(@allowedSchema)
        AND LOWER(TABLE_NAME) = LOWER(@allowedTable)
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `);
        return buildSchemaHintFromRows((result.recordset ?? []));
    }
    catch {
        return '';
    }
    finally {
        await pool.close();
    }
}
function resolveModel(inputModel, defaultModel) {
    if (typeof inputModel === 'string' && inputModel.trim())
        return inputModel.trim();
    return defaultModel;
}
function buildRequestBody(provider, messages, model) {
    if (provider === 'gemini') {
        return {
            ...mapMessagesForGemini(messages),
            ...(model ? { model } : {}),
        };
    }
    return {
        messages,
        ...(model ? { model } : {}),
    };
}
function buildHeaders(provider, authHeader, apiKey) {
    const headers = {
        'Content-Type': 'application/json',
    };
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
    return fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}
async function completeWithAI(config, messages, model) {
    if (!config.apiUrl) {
        throw new Error('Falta configurar AI_API_URL.');
    }
    const requestBody = buildRequestBody(config.provider, messages, model);
    const headers = buildHeaders(config.provider, config.authHeader, config.apiKey);
    const upstreamResponse = await requestUpstream(config.apiUrl, headers, requestBody);
    if (!upstreamResponse.ok) {
        const detail = await getUpstreamErrorDetail(upstreamResponse);
        const hint = upstreamResponse.status === 429
            ? 'Revisa cuotas/rate limits en Gemini y confirma billing habilitado.'
            : undefined;
        const reason = hint ? `${detail} ${hint}` : detail;
        throw new Error(reason);
    }
    const payload = (await upstreamResponse.json());
    return resolveAssistantText(payload);
}
function getLastUserQuestion(messages) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') {
            return messages[index].content;
        }
    }
    throw new Error('No se encontró una pregunta del usuario para convertir a SQL.');
}
function unwrapCodeFence(value) {
    const fencedRegex = /```(?:sql)?\s*([\s\S]*?)```/i;
    const fenced = fencedRegex.exec(value);
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
    if (!singleLine) {
        throw new Error('La IA no devolvió SQL utilizable.');
    }
    return singleLine.replace(/;\s*$/, '');
}
function validateReadOnlySql(sqlQuery) {
    const normalized = sqlQuery.trim();
    const lower = normalized.toLowerCase();
    if (!(lower.startsWith('select') || lower.startsWith('with'))) {
        throw new Error('Solo se permiten consultas de lectura (SELECT / WITH).');
    }
    if (DANGEROUS_SQL_KEYWORDS.some((pattern) => pattern.test(lower))) {
        throw new Error('La consulta generada incluye comandos no permitidos para solo lectura.');
    }
    if (lower.includes('--') || lower.includes('/*') || lower.includes('*/')) {
        throw new Error('La consulta generada contiene comentarios SQL no permitidos.');
    }
    return normalized;
}
async function generateSqlFromQuestion(config, question, schemaHint, previousError) {
    const systemPrompt = [
        // === ROL Y ALCANCE ===
        `Eres un asistente experto en SQL T-SQL para SQL Server.
Tu única función es convertir preguntas de negocio en consultas SQL de solo lectura.`,
        // === RESTRICCIONES DE SEGURIDAD (no negociables) ===
        `RESTRICCIONES ABSOLUTAS:
- Solo puedes generar sentencias SELECT o WITH ... SELECT.
- Prohibido usar: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, EXEC.
- Prohibido generar múltiples sentencias separadas por punto y coma.
- Prohibido usar subconsultas o JOINs a tablas distintas a [${config.dbAllowedSchema}].[${config.dbAllowedTable}].
- Si la pregunta no puede responderse con una consulta de lectura, responde: "No puedo generar esa consulta."`,
        // === TABLA PERMITIDA ===
        `TABLA ÚNICA PERMITIDA: [${config.dbAllowedSchema}].[${config.dbAllowedTable}]
- Siempre califica con esquema. Ejemplo: FROM [${config.dbAllowedSchema}].[${config.dbAllowedTable}]
- No uses ninguna otra tabla, vista o función de tabla.
- Nunca uses referencias sin esquema.`,
        // === FORMATO DE RESPUESTA ===
        `FORMATO DE SALIDA:
- Devuelve ÚNICAMENTE el SQL, sin explicaciones, sin markdown, sin bloques de código.
- No incluyas comentarios (--) ni texto fuera del SQL.`,
        // === ESQUEMA DE LA TABLA ===
        `ESQUEMA Y SIGNIFICADO DE COLUMNAS:
Usa ÚNICAMENTE los nombres de columna listados aquí. Respeta mayúsculas/minúsculas exactas. No inventes columnas.

| Columna            | Tipo    | Descripción                                                                 |
|--------------------|---------|-----------------------------------------------------------------------------|
| [ano]              | int     | Año del registro. Ej: WHERE [ano] = 2024                                    |
| [mes]              | int     | Mes del registro (1-12). Ej: WHERE [mes] = 3                                |
| [grupogerencial]   | varchar | Categoría gerencial de alto nivel. Ej: 'Gastos directos', 'Ingresos', 'Otros costos y gastos' |
| [grupo]            | varchar | Grupo contable dentro de la categoría gerencial                             |
| [Subgrupo]         | varchar | Subgrupo contable detallado. Ej: 'NOMINA', 'HONORARIOS', 'ARRIENDOS', 'DEPRECIACIONES Y AMORTIZACIONES', 'LICENCIAS SOFTWARE'. (La S de Subgrupo es MAYÚSCULA) |
| [total_valor]      | float   | Valor ejecutado total del registro                                          |
| [total_valormes]   | float   | Valor ejecutado mensual                                                     |
| [total_presupuesto]| float   | Valor presupuestado                                                         |`,
        // === REGLAS DE NEGOCIO ===
        `REGLAS DE NEGOCIO:

1. FILTROS POR SUBGRUPO
   - Los valores de [Subgrupo] están en MAYÚSCULAS. Ej: WHERE [Subgrupo] = 'NOMINA'
   - Para listar subgrupos disponibles: SELECT DISTINCT [Subgrupo] FROM [${config.dbAllowedSchema}].[${config.dbAllowedTable}]

2. TOTALES Y AGRUPACIONES
   - Usa SUM() para agregar valores cuando se pidan totales.
   - Agrupa por [ano] y/o [mes] para análisis por periodo.
   - Agrupa por [grupogerencial], [grupo] o [Subgrupo] para análisis por categoría.

3. EJECUTADO VS PRESUPUESTO
   - [total_valor] = valor ejecutado real.
   - [total_presupuesto] = valor presupuestado.
   - Para comparar: incluye ambas columnas con alias descriptivos. Ej: SUM([total_valor]) AS ejecutado, SUM([total_presupuesto]) AS presupuesto

4. CÁLCULO DE EBITDA
   EBITDA = Ingresos - Gastos directos - Otros costos y gastos + Depreciaciones y Amortizaciones

   Patrón recomendado:
   SELECT [grupogerencial], SUM([total_valor]) AS total
   FROM [${config.dbAllowedSchema}].[${config.dbAllowedTable}]
   WHERE [ano] = <año solicitado>
   GROUP BY [grupogerencial]
   -- (El cálculo de EBITDA se hace en la capa de aplicación sumando/restando los grupos)

5. AMBIGÜEDAD
   - Si el usuario menciona un Subgrupo con minúsculas (ej: "nómina"), conviértelo a mayúsculas en el filtro.
   - Si el usuario no especifica año o mes, no filtres por periodo a menos que sea evidente en el contexto.`,
        // === CONTEXTO DINÁMICO ===
        schemaHint
            ? `CONTEXTO DE ESQUEMA ADICIONAL (descubierto en tiempo de ejecución):\n${schemaHint}`
            : '',
        previousError
            ? `AVISO - ERROR EN CONSULTA ANTERIOR (evita repetir el mismo patrón):\n${previousError}`
            : '',
    ].filter(Boolean).join('\n\n');
    const sqlDraft = await completeWithAI(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
    ], config.sqlModel);
    const sqlCandidate = extractSqlCandidate(sqlDraft);
    const readOnlySql = validateReadOnlySql(sqlCandidate);
    validateAllowedTableUsage(readOnlySql, config.dbAllowedSchema, config.dbAllowedTable);
    return readOnlySql;
}
async function executeSqlQuery(config, sqlQuery) {
    const dbPoolConfig = resolveDbPoolConfig(config);
    const target = resolveDbTarget(config);
    const pool = new mssql_1.default.ConnectionPool(dbPoolConfig);
    try {
        await pool.connect();
        const request = pool.request();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`La consulta SQL excedió el timeout de ${config.dbTimeoutMs} ms.`));
            }, config.dbTimeoutMs);
        });
        const result = await Promise.race([request.query(sqlQuery), timeoutPromise]);
        const records = (result.recordset ?? []);
        return records.slice(0, config.dbMaxRows);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido al consultar la base de datos.';
        if (/database was not found|insufficient permissions to connect to it|login failed/i.test(message)) {
            throw new Error(`${message} (target: server=${target.server}, database=${target.database}). ` +
                'Verifica que DB_DATABASE sea el nombre exacto de la base de datos y que el usuario tenga permisos de acceso y lectura.');
        }
        throw new Error(`${message} (target: server=${target.server}, database=${target.database})`);
    }
    finally {
        await pool.close();
    }
}
function summarizeRows(rows) {
    if (!rows.length)
        return '[]';
    return JSON.stringify(rows);
}
function resolveLanguage(value) {
    return value === 'en' ? 'en' : 'es';
}
function buildLanguageInstruction(language) {
    return language === 'en'
        ? 'Respond exclusively in English, clearly and actionably.'
        : 'Responde exclusivamente en español de forma clara y accionable.';
}
function buildAnswerSystemPrompt(language) {
    const isEN = language === 'en';
    const roleBlock = isEN
        ? `You are a financial data analyst. Answer ONLY based on the SQL query results provided. Do not use external knowledge or assumptions beyond what the data shows.
If the data is insufficient to answer the question, say so clearly and specify what additional data would be needed.`
        : `Eres un analista de datos financieros. Responde ÚNICAMENTE con base en los resultados de la consulta SQL entregada. No uses conocimiento externo ni hagas suposiciones más allá de lo que muestran los datos.
Si los datos son insuficientes para responder la pregunta, dilo claramente e indica qué dato adicional se necesitaría.`;
    const domainBlock = isEN
        ? `DATA STRUCTURE CONTEXT:
- [grupogerencial]: High-level management category. Known values: "Ingresos", "Gastos directos", "Otros costos y gastos".
- [grupo]: Accounting group within the management category.
- [Subgrupo]: Detailed accounting line item. Examples: NOMINA, HONORARIOS, ARRIENDOS, DEPRECIACIONES Y AMORTIZACIONES, LICENCIAS SOFTWARE.
- [total_valor]: Actual/executed value.
- [total_presupuesto]: Budgeted value.
- [ano] / [mes]: Year and month of the record.`
        : `CONTEXTO DE ESTRUCTURA DE DATOS:
- [grupogerencial]: Categoría gerencial de alto nivel. Valores conocidos: "Ingresos", "Gastos directos", "Otros costos y gastos".
- [grupo]: Grupo contable dentro de la categoría gerencial.
- [Subgrupo]: Rubro contable detallado. Ejemplos: NOMINA, HONORARIOS, ARRIENDOS, DEPRECIACIONES Y AMORTIZACIONES, LICENCIAS SOFTWARE.
- [total_valor]: Valor ejecutado real.
- [total_presupuesto]: Valor presupuestado.
- [ano] / [mes]: Año y mes del registro.`;
    const ebitdaBlock = isEN
        ? `EBITDA CALCULATION RULE (apply only when the question involves EBITDA):
  EBITDA = Ingresos − Gastos directos − Otros costos y gastos + DEPRECIACIONES Y AMORTIZACIONES

  Steps:
  1. Sum all rows where [grupogerencial] = "Ingresos"
  2. Subtract sum where [grupogerencial] = "Gastos directos"
  3. Subtract sum where [grupogerencial] = "Otros costos y gastos"
  4. Add back sum where [Subgrupo] = "DEPRECIACIONES Y AMORTIZACIONES"

  - If any component is missing from the data, use 0 and flag it explicitly.
  - Always present the calculation step by step.`
        : `REGLA DE CÁLCULO EBITDA (aplica solo cuando la pregunta involucre EBITDA):
  EBITDA = Ingresos − Gastos directos − Otros costos y gastos + DEPRECIACIONES Y AMORTIZACIONES

  Pasos:
  1. Suma filas donde [grupogerencial] = "Ingresos"
  2. Resta suma donde [grupogerencial] = "Gastos directos"
  3. Resta suma donde [grupogerencial] = "Otros costos y gastos"
  4. Suma de vuelta donde [Subgrupo] = "DEPRECIACIONES Y AMORTIZACIONES"

  - Si falta algún componente en los datos, usa 0 e indícalo explícitamente.
  - Presenta siempre el cálculo paso a paso.`;
    const formatBlock = isEN
        ? `OUTPUT FORMAT RULES (always apply):
- Respond exclusively in valid HTML. No markdown, no code blocks (\`\`\`), no Mermaid.
- Do NOT use heading tags (h1–h6). Use <strong> for titles or key concepts instead.
- Monetary values: always format with thousand separators. Ej: 1,250,000.
- For calculations or comparisons → use an HTML table with columns: <th>Component</th><th>Value</th>
- For lists → use <ul><li> structure.
- For single key values → use <p><strong>Label:</strong> value</p>.`
        : `REGLAS DE FORMATO DE SALIDA (aplica siempre):
- Responde exclusivamente en HTML válido. Sin markdown, sin bloques de código (\`\`\`), sin Mermaid.
- NO uses etiquetas de encabezado (h1–h6). Usa <strong> para títulos o conceptos clave.
- Valores monetarios: formatea siempre con separadores de miles. Ej: 1.250.000.
- Para cálculos o comparaciones → usa tabla HTML con columnas: <th>Concepto</th><th>Valor</th>
- Para listas → usa estructura <ul><li>.
- Para valores clave únicos → usa <p><strong>Etiqueta:</strong> valor</p>.`;
    const chartBlock = isEN
        ? `CHART RULES (only when the user explicitly requests a chart):
- Use QuickChart (quickchart.io) only. Allowed types: bar, pie, line.
- Include exactly ONE <img> tag with src from quickchart.io.
- Style: style="width:80%; max-width:500px;"
- Always include the datalabels plugin to show values above each bar/segment.
- URL-encode the chart config. Do not use backticks or markdown.

Example:
<img src="https://quickchart.io/chart?c={type:'bar',data:{labels:['Executed','Budgeted'],datasets:[{label:'Value',data:[63000,85000]}]},options:{plugins:{datalabels:{anchor:'end',align:'top',font:{weight:'bold'}}}}}" style="width:80%; max-width:500px;">`
        : `REGLAS DE GRÁFICOS (solo cuando el usuario lo solicite explícitamente):
- Usa únicamente QuickChart (quickchart.io). Tipos permitidos: bar, pie, line.
- Incluye exactamente UNA etiqueta <img> con src de quickchart.io.
- Estilo: style="width:80%; max-width:500px;"
- Siempre incluye el plugin datalabels para mostrar valores encima de cada barra/segmento.
- Codifica la URL del config del gráfico. No uses backticks ni markdown.

Ejemplo:
<img src="https://quickchart.io/chart?c={type:'bar',data:{labels:['Ejecutado','Presupuestado'],datasets:[{label:'Valor',data:[63000,85000]}]},options:{plugins:{datalabels:{anchor:'end',align:'top',font:{weight:'bold'}}}}}" style="width:80%; max-width:500px;">`;
    return [
        roleBlock,
        domainBlock,
        ebitdaBlock,
        formatBlock,
        chartBlock,
        buildLanguageInstruction(language),
    ]
        .filter(Boolean)
        .join('\n\n---\n\n');
}
function buildAnswerUserPrompt(question, sqlQuery, rowsSummary) {
    return [
        `USER QUESTION: ${question}`,
        `EXECUTED SQL:\n${sqlQuery}`,
        `QUERY RESULTS (JSON):\n${rowsSummary}`,
        'Generate the final response to the user following all system rules.',
    ].join('\n\n');
}
async function answerWithData(config, question, sqlQuery, rows, language) {
    const rowsSummary = summarizeRows(rows);
    const systemPrompt = buildAnswerSystemPrompt(language);
    const userPrompt = buildAnswerUserPrompt(question, sqlQuery, rowsSummary);
    return completeWithAI(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ], config.answerModel);
}
function injectLanguageHint(messages, language) {
    const hint = buildLanguageInstruction(language);
    return [{ role: 'system', content: hint }, ...messages];
}
async function handleDirectChat(config, parsed, messages, language) {
    const model = resolveModel(parsed.model, config.defaultModel);
    const messagesWithLanguage = injectLanguageHint(messages, language);
    const message = await completeWithAI(config, messagesWithLanguage, model);
    return { message };
}
async function handleDbAgentFlow(config, messages, language) {
    const question = getLastUserQuestion(messages);
    const discoveredSchemaHint = await discoverSchemaHint(config);
    const baseSchemaHint = [config.dbSchemaHint, discoveredSchemaHint].filter(Boolean).join('\n\n').trim();
    let sqlQuery = await generateSqlFromQuestion(config, question, baseSchemaHint);
    let rows = [];
    try {
        rows = await executeSqlQuery(config, sqlQuery);
    }
    catch (error) {
        const firstError = error instanceof Error ? error.message : 'Error desconocido al ejecutar SQL.';
        if (!isInvalidObjectNameError(firstError)) {
            throw error;
        }
        const retrySchemaHint = await discoverSchemaHint(config);
        const mergedRetryHint = [config.dbSchemaHint, retrySchemaHint].filter(Boolean).join('\n\n').trim();
        sqlQuery = await generateSqlFromQuestion(config, question, mergedRetryHint, firstError);
        rows = await executeSqlQuery(config, sqlQuery);
    }
    const message = await answerWithData(config, question, sqlQuery, rows, language);
    return {
        message,
        meta: {
            sql: sqlQuery,
            rows: rows.length,
            source: 'sql-db',
        },
    };
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
        // Fallback to generic status below.
    }
    return `El proveedor IA respondió con estado ${response.status}.`;
}
async function handler(event) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim() || '*';
    const method = event.httpMethod ?? 'POST';
    if (method === 'OPTIONS') {
        return jsonResponse(204, {}, allowedOrigin);
    }
    if (method !== 'POST') {
        return jsonResponse(405, { error: 'Método no permitido.' }, allowedOrigin);
    }
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
            const directResult = await handleDirectChat(config, parsed, messages, language);
            return jsonResponse(200, directResult, allowedOrigin);
        }
        const dbResult = await handleDbAgentFlow(config, messages, language);
        return jsonResponse(200, dbResult, allowedOrigin);
    }
    catch (error) {
        const safeMessage = error instanceof Error ? error.message : 'Error inesperado del proxy.';
        return jsonResponse(400, { error: safeMessage }, allowedOrigin);
    }
}
