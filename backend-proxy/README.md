# FIBOT — Backend Proxy (TypeScript)

Proxy de backend que protege credenciales y orquesta el flujo completo de análisis financiero:
clasifica la intención del usuario, genera SQL seguro, ejecuta consultas en Azure SQL Server y
produce respuestas en HTML enriquecido usando un modelo de IA.

## Índice

- [Arquitectura](#arquitectura)
- [Flujo de ejecución](#flujo-de-ejecución)
- [Plataformas soportadas](#plataformas-soportadas)
- [Variables de entorno](#variables-de-entorno)
- [Modos de conexión a SQL Server](#modos-de-conexión-a-sql-server)
- [Modos de operación del proxy](#modos-de-operación-del-proxy)
- [Seguridad SQL](#seguridad-sql)
- [Compilar y empaquetar](#compilar-y-empaquetar)
- [Despliegue en Azure Functions](#despliegue-en-azure-functions)
- [Despliegue en AWS Lambda](#despliegue-en-aws-lambda)
- [Desarrollo local](#desarrollo-local)
- [Recomendaciones de seguridad](#recomendaciones-de-seguridad)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIBOT BACKEND PROXY                      │
│                                                                 │
│  HTTP Request (POST /chat)                                      │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐     ┌──────────────────────────────────────┐  │
│  │   Sanitize  │────►│        processRequest()              │  │
│  │   & Route   │     │  (platform-agnostic core handler)    │  │
│  └─────────────┘     └──────────────┬───────────────────────┘  │
│                                     │                           │
│                     ┌───────────────┼───────────────┐          │
│                     │               │               │          │
│                     ▼               ▼               ▼          │
│              No DB config     DB config         DB config      │
│              ┌──────────┐   + Data question  + Conversational  │
│              │  Direct  │  ┌────────────────┐ ┌─────────────┐  │
│              │   Chat   │  │  DB Agent Flow │ │  Chat with  │  │
│              └──────────┘  │                │ │  context    │  │
│                            │ 1. Schema hint │ └─────────────┘  │
│                            │ 2. Gen SQL     │                  │
│                            │ 3. Validate    │                  │
│                            │ 4. Execute     │                  │
│                            │ 5. Answer      │                  │
│                            └───────┬────────┘                  │
│                                    │                           │
└────────────────────────────────────┼───────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
      ┌──────────────┐      ┌───────────────┐      ┌──────────────┐
      │  AI Provider │      │  Azure SQL    │      │  AI Provider │
      │  (SQL Model) │      │  Server       │      │ (Answer Mdl) │
      └──────────────┘      └───────────────┘      └──────────────┘
```

---

## Flujo de ejecución

### Pregunta de datos financieros

```
Usuario: "¿Cuáles fueron los ingresos de enero 2025?"
    │
    ▼
[1] Descubrir esquema ──► INFORMATION_SCHEMA.COLUMNS ──► lista de tablas/columnas
    │
    ▼
[2] Generar SQL ──► AI (sqlModel) con sistema de reglas + esquema descubierto
    │              Resultado: SELECT ... FROM [finanzas].[vw_estado_resultados] WHERE periodo = '2025-01'
    ▼
[3] Validar SQL ──► solo SELECT/WITH · sin DML · esquema explícito · tablas permitidas
    │
    ▼
[4] Ejecutar SQL ──► Azure SQL Server (con timeout configurable)
    │              Resultado: [{ingresos: 1250000, periodo: '2025-01'}]
    ▼
[5] Generar respuesta ──► AI (answerModel) con pregunta + SQL + datos JSON
    │                    Resultado: HTML enriquecido con tabla y valores formateados
    ▼
[6] HTTP 200 ──► { message: "<p><strong>Ingresos enero 2025:</strong> 1.250.000</p>", meta: {...} }
```

### Pregunta conversacional

```
Usuario: "¿Qué reportes me puedes dar?"
    │
    ▼
[1] AI genera SQL ──► responde "CONVERSATIONAL" (señal interna)
    │
    ▼
[2] Respuesta conversacional ──► AI con prompt de capacidades financieras
    │                           Lista de reportes disponibles en HTML
    ▼
[3] HTTP 200 ──► { message: "<ul><li>Estado de Resultados...</li></ul>" }
```

---

## Plataformas soportadas

El mismo código fuente (`dist/index.js`) se adapta automáticamente a la plataforma en ejecución:

| Plataforma | Activación | Paquete |
|---|---|---|
| **Azure Functions v4** | `@azure/functions` instalado en `node_modules` | `azure-function.zip` |
| **AWS Lambda** | fallback cuando `@azure/functions` no está presente | `lambda.zip` |

El adaptador de cada plataforma es un thin wrapper sobre `processRequest()`:

```
processRequest(method, bodyText)   ← lógica de negocio compartida
       ├── Azure Functions app.http('fibotProxy') ← adaptador Azure
       └── export handler(event)                  ← adaptador Lambda
```

---

## Variables de entorno

### Proveedor de IA

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `AI_API_URL` | Sí | — | Endpoint del proveedor IA (completions o generateContent) |
| `AI_API_KEY` | Recomendada | `""` | API key o token de autenticación |
| `AI_AUTH_HEADER` | No | `Authorization` | Header HTTP para enviar la API key |
| `AI_PROVIDER` | No | `openai-compatible` | `openai-compatible` o `gemini` |
| `AI_MODEL` | No | `""` | Modelo por defecto para las tres etapas |
| `AI_SQL_MODEL` | No | `AI_MODEL` | Modelo exclusivo para la etapa pregunta→SQL |
| `AI_ANSWER_MODEL` | No | `AI_MODEL` | Modelo exclusivo para la etapa datos→respuesta |
| `ALLOWED_ORIGIN` | No | `*` | Origen CORS permitido (ej: `https://tudominio.com`) |

### Base de datos SQL Server

| Variable | Descripción |
|---|---|
| `DB_CONNECTION_STRING` | Cadena de conexión completa — Modo 1 (mayor prioridad) |
| `DB_SERVER` | Host del servidor, ej: `financialfibot.database.windows.net,1433` |
| `DB_DATABASE` | Nombre de la base de datos |
| `DB_USER` | Usuario SQL — Modo 2 (SQL auth) |
| `DB_PASSWORD` | Contraseña SQL — Modo 2 |
| `AZURE_TENANT_ID` | Tenant Entra ID — Modo 3 (Service Principal) |
| `AZURE_CLIENT_ID` | Application (client) ID — Modo 3 |
| `AZURE_CLIENT_SECRET` | Client secret — Modo 3 |
| `DB_ALLOWED_SCHEMA` | Esquema SQL permitido. Default: `dbo` |
| `DB_ALLOWED_TABLES` | Tablas/vistas permitidas, separadas por coma. Vacío = cualquiera del esquema |
| `DB_ALLOWED_TABLE` | Tabla única (legado — usar `DB_ALLOWED_TABLES`) |
| `DB_SCHEMA_HINT` | Contexto de negocio adicional inyectado al prompt SQL |
| `DB_MAX_ROWS` | Límite de filas retornadas al modelo. Default: `100` |
| `DB_TIMEOUT_SECONDS` | Timeout de consulta SQL en segundos. Default: `30` |

---

## Modos de conexión a SQL Server

El proxy detecta automáticamente qué modo usar según las variables presentes:

**Modo 1 — Connection String** (prioridad máxima):
```
DB_CONNECTION_STRING=Server=tcp:financialfibot.database.windows.net,1433;Database=FinancialDB;User ID=financialfibot;Password=<pass>;Encrypt=true;TrustServerCertificate=false;
```

**Modo 2 — SQL Auth** (usuario y contraseña):
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=FinancialDB
DB_USER=financialfibot
DB_PASSWORD=<pass>
```

**Modo 3 — Service Principal** (Azure AAD / Entra ID):
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=FinancialDB
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<client-id>
AZURE_CLIENT_SECRET=<secret>
```

Sin ninguna configuración de BD → el proxy opera como relay de chat directo.

---

## Modos de operación del proxy

### Modo 1: Chat directo (sin BD)

El proxy actúa como relay seguro: recibe los mensajes del frontend, los reenvía al proveedor IA y devuelve la respuesta. Protege la API key sin exponer credenciales al navegador.

### Modo 2: Agente SQL financiero (con BD)

Flujo completo de 5 pasos:

1. **Descubrimiento de esquema**: consulta `INFORMATION_SCHEMA.COLUMNS` para obtener tablas y columnas disponibles.
2. **Enrutamiento de intención**: el modelo decide si la pregunta necesita SQL (`DATA`) o es conversacional (`CONVERSATIONAL`).
3. **Generación SQL**: el modelo produce T-SQL seguro restringido al esquema y tablas configuradas.
4. **Validación en capas**: solo `SELECT`/`WITH`, sin DML, esquema explícito, tabla en lista permitida, sin comentarios SQL.
5. **Ejecución y respuesta**: ejecuta en Azure SQL, pasa resultados al modelo para generar HTML enriquecido.
6. **Retry automático**: ante error `Invalid object name`, redescubre el esquema y regenera el SQL.

### Modo conversacional (dentro del modo 2)

Cuando el modelo detecta que la pregunta es un saludo, pregunta sobre capacidades o concepto financiero, responde directamente con un prompt que conoce todos los reportes disponibles — sin tocar la base de datos.

---

## Seguridad SQL

El proxy aplica múltiples capas de protección antes de ejecutar cualquier consulta:

| Capa | Qué valida |
|---|---|
| **Solo lectura** | La consulta debe comenzar con `SELECT` o `WITH` |
| **DML bloqueado** | Rechaza `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `MERGE`, `EXEC`, `EXECUTE`, `GRANT`, `REVOKE` |
| **Comentarios SQL** | Rechaza `--`, `/*`, `*/` |
| **Esquema explícito** | Todas las referencias a tablas deben incluir el esquema (`[finanzas].[tabla]`) |
| **Whitelist de esquema** | Solo se permite el esquema configurado en `DB_ALLOWED_SCHEMA` |
| **Whitelist de tablas** | Si `DB_ALLOWED_TABLES` está definido, solo esas tablas son accesibles |
| **Timeout** | Consultas que excedan `DB_TIMEOUT_SECONDS` son canceladas |
| **Límite de filas** | Solo se devuelven hasta `DB_MAX_ROWS` registros al modelo |

---

## Compilar y empaquetar

```bash
# Desde la raíz del proyecto:

# 1. Compilar TypeScript → dist/index.js
npm run build:proxy

# 2a. Empaquetar para Azure Functions → azure-function.zip
npm run package:azure

# 2b. Empaquetar para AWS Lambda → lambda.zip
npm run package:proxy
```

### Estructura del paquete Azure Functions

```
azure-function.zip
├── host.json              ← configuración del runtime de Azure Functions
├── package.json           ← dependencias (@azure/functions + mssql)
├── dist/
│   └── index.js           ← código compilado
└── node_modules/
    ├── @azure/functions/
    ├── mssql/
    └── ...
```

### Estructura del paquete Lambda

```
lambda.zip
├── index.js               ← código compilado
├── package.json           ← dependencias (mssql)
└── node_modules/
    ├── mssql/
    └── ...
```

---

## Despliegue en Azure Functions

### Requisitos previos en Azure

1. **Function App** creada con:
   - Runtime: `Node.js 20`
   - OS: `Linux`
   - Plan: Consumption (Serverless) o Premium

2. **Networking**: si usas Azure SQL con acceso público restringido, la Function App debe tener IP fija o estar en la misma VNet que el SQL Server.

### Despliegue con Azure CLI

```bash
# Login
az login

# Compilar y empaquetar
npm run build:proxy
npm run package:azure

# Desplegar
az functionapp deployment source config-zip `
  --resource-group <resource-group> `
  --name <function-app-name> `
  --src backend-proxy/azure-function.zip
```

### Despliegue desde el Portal Azure

1. Portal Azure → **Function App** → tu app → **Deployment Center**
2. O via **Advanced Tools (Kudu)** → **Tools → Zip Push Deploy**
3. Arrastra `azure-function.zip`

### Configurar variables de entorno en Azure

Portal Azure → Function App → **Configuration → Application settings**:

```
AI_API_URL          = <url del proveedor IA>
AI_API_KEY          = <api key>
AI_PROVIDER         = gemini  (o openai-compatible)
AI_AUTH_HEADER      = x-goog-api-key  (si es Gemini)
ALLOWED_ORIGIN      = https://tu-dominio-frontend.com
DB_SERVER           = financialfibot.database.windows.net,1433
DB_DATABASE         = FinancialDB
DB_USER             = financialfibot
DB_PASSWORD         = <contraseña>
DB_ALLOWED_SCHEMA   = finanzas
DB_MAX_ROWS         = 200
DB_TIMEOUT_SECONDS  = 45
```

### URL del endpoint

```
https://<function-app-name>.azurewebsites.net/api/chat
```

Configura esta URL en el frontend como `VITE_AI_API_URL`.

---

## Despliegue en AWS Lambda

### Configuración de Lambda

- **Runtime**: `Node.js 20.x`
- **Handler**: `index.handler`
- **Timeout**: mínimo 60 segundos (recomendado 90s para el flujo SQL completo)
- **Memory**: 256 MB mínimo

### Despliegue

```bash
npm run build:proxy
npm run package:proxy
aws lambda update-function-code \
  --function-name fibot-ai-proxy \
  --zip-file fileb://backend-proxy/lambda.zip
```

### IP fija para Azure SQL (requerida)

Lambda no tiene IP fija por defecto. Para conectar a Azure SQL con firewall restringido:

1. Crear **VPC + NAT Gateway + Elastic IP** en AWS
2. Asociar Lambda a la VPC (subnet privada)
3. Agregar la **Elastic IP** del NAT Gateway en las reglas de firewall de Azure SQL

---

## Desarrollo local

Para probar localmente con Azure Functions Core Tools:

```bash
# Instalar Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Ir al directorio del proxy
cd backend-proxy

# Instalar @azure/functions como devDependency para tipos
npm install @azure/functions --save-dev

# Compilar
cd ..
npm run build:proxy

# Levantar la función local (desde backend-proxy/)
cd backend-proxy
func start
```

El endpoint local será: `http://localhost:7071/api/chat`

Configura las variables en `backend-proxy/local.settings.json` (ya incluido en `.gitignore`).

---

## Recomendaciones de seguridad

- **Secretos**: guarda `AI_API_KEY`, `DB_PASSWORD` y `AZURE_CLIENT_SECRET` en Azure Key Vault o AWS Secrets Manager — nunca en código o repositorio.
- **CORS**: define `ALLOWED_ORIGIN` con tu dominio exacto, no uses `*` en producción.
- **Whitelist de tablas**: define siempre `DB_ALLOWED_SCHEMA` y `DB_ALLOWED_TABLES` para limitar el acceso a datos.
- **Usuario de BD**: crea un usuario SQL con permisos solo de `SELECT` sobre el esquema permitido.
- **Logs**: habilita Application Insights (Azure) o CloudWatch (AWS) para monitorear errores.
- **Timeout**: ajusta `DB_TIMEOUT_SECONDS` según la complejidad real de tus consultas.
- **Actualización de dependencias**: mantén `mssql` y `@azure/functions` actualizados para recibir parches de seguridad.
