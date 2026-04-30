# Backend Proxy AWS Lambda (TypeScript)

Este proxy protege la API key del proveedor de IA y soporta un flujo de agente con SQL Server:

1. IA convierte pregunta del usuario a SQL.
2. Lambda ejecuta SQL en la base de datos configurada.
3. Lambda envía resultados a la IA para generar la respuesta final.

## Arquitectura recomendada

- Frontend React en S3 + CloudFront.
- Proxy en AWS Lambda.
- Exposición vía API Gateway (HTTP API).

## Variables de entorno de Lambda

### IA

- `AI_API_URL` (requerido): endpoint del proveedor IA.
- `AI_API_KEY` (opcional/recomendado): token o API key.
- `AI_MODEL` (opcional): modelo por defecto.
- `AI_AUTH_HEADER` (opcional): por defecto `Authorization`.
- `AI_PROVIDER` (opcional): `openai-compatible` (default) o `gemini`.
- `AI_SQL_MODEL` (opcional): modelo para etapa pregunta→SQL.
- `AI_ANSWER_MODEL` (opcional): modelo para etapa resultados→respuesta final.
- `ALLOWED_ORIGIN` (opcional): origen permitido para CORS, por ejemplo `https://tudominio.com`.

### Base de datos SQL Server

- `DB_CONNECTION_STRING` (opcional): cadena de conexión completa SQL Server.
- `DB_SERVER` (opcional): host del servidor. Ej: `financialfibot.database.windows.net,1433`.
- `DB_DATABASE` (opcional): nombre de la base de datos.
- `DB_USER` (opcional): usuario SQL Server para autenticación SQL auth.
- `DB_PASSWORD` (opcional): contraseña del usuario SQL auth.
- `AZURE_TENANT_ID` (opcional): tenant Entra ID para Service Principal AAD.
- `AZURE_CLIENT_ID` (opcional): Application (client) ID de App Registration.
- `AZURE_CLIENT_SECRET` (opcional): client secret de App Registration.
- `DB_ALLOWED_SCHEMA` (opcional): esquema permitido para consultas SQL generadas. Default: `dbo`.
- `DB_ALLOWED_TABLE` (opcional): tabla permitida. Default: `fact_presupuesto_gold`.
- `DB_SCHEMA_HINT` (opcional): contexto de tablas/columnas para mejorar SQL generado.
- `DB_MAX_ROWS` (opcional): límite de filas retornadas al prompt final. Default: `100`.
- `DB_TIMEOUT_SECONDS` (opcional): timeout de consulta SQL. Default: `30`.

### Modos de conexión a SQL Server

El proxy activa el flujo SQL cuando se detecta alguna de estas configuraciones (en orden de prioridad):

**Modo 1 — Connection String:**
```
DB_CONNECTION_STRING=Server=tcp:financialfibot.database.windows.net,1433;Database=midb;User ID=financialfibot;Password=<password>;Encrypt=true;TrustServerCertificate=false;
```

**Modo 2 — SQL Auth (usuario/contraseña):**
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
DB_USER=financialfibot
DB_PASSWORD=<password>
```

**Modo 3 — Service Principal (Azure AAD):**
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<client-secret>
```

Si ninguna configuración de BD está presente, el proxy opera en modo chat directo (sin consultas SQL).

## Ejemplos de configuración completa

### Azure SQL + Google Gemini (SQL Auth)

```
AI_PROVIDER=gemini
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<TU_GEMINI_API_KEY>
AI_AUTH_HEADER=x-goog-api-key
ALLOWED_ORIGIN=https://tu-dominio-frontend.com
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
DB_USER=financialfibot
DB_PASSWORD=<password>
DB_ALLOWED_SCHEMA=dbo
DB_ALLOWED_TABLE=fact_presupuesto_gold
DB_MAX_ROWS=100
DB_TIMEOUT_SECONDS=30
```

### Azure SQL + Google Gemini (Connection String)

```
AI_PROVIDER=gemini
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<TU_GEMINI_API_KEY>
AI_AUTH_HEADER=x-goog-api-key
DB_CONNECTION_STRING=Server=tcp:financialfibot.database.windows.net,1433;Database=midb;User ID=financialfibot;Password=<password>;Encrypt=true;TrustServerCertificate=false;
DB_ALLOWED_SCHEMA=dbo
DB_ALLOWED_TABLE=fact_presupuesto_gold
```

### Azure SQL + Service Principal (sin contraseña de usuario)

```
AI_PROVIDER=gemini
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<TU_GEMINI_API_KEY>
AI_AUTH_HEADER=x-goog-api-key
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<client-secret>
DB_ALLOWED_SCHEMA=dbo
DB_ALLOWED_TABLE=fact_presupuesto_gold
```

### Chat directo (sin base de datos)

```
AI_PROVIDER=gemini
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<TU_GEMINI_API_KEY>
AI_AUTH_HEADER=x-goog-api-key
ALLOWED_ORIGIN=https://tu-dominio-frontend.com
```

## Compilar

Desde la raíz del proyecto:

```bash
npm run build:proxy
```

Salida compilada:

- `backend-proxy/dist/index.js`

## Empaquetar para Lambda

```bash
npm run package:proxy
```

Genera `backend-proxy/lambda.zip` incluyendo `index.js` y dependencias runtime.

## Configuración correcta de Lambda

- Runtime: `Node.js 20.x`.
- Handler: `index.handler`.
- Compila a CommonJS.

## Despliegue rápido con AWS CLI

1. Crear rol de ejecución para Lambda (si no existe):

```bash
aws iam create-role --role-name fibot-lambda-role --assume-role-policy-document file://trust-policy.json
aws iam attach-role-policy --role-name fibot-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

2. Crear función:

```bash
aws lambda create-function \
  --function-name fibot-ai-proxy \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://backend-proxy/lambda.zip \
  --role arn:aws:iam::<ACCOUNT_ID>:role/fibot-lambda-role \
  --environment "Variables={AI_API_URL=<URL>,AI_API_KEY=<KEY>,ALLOWED_ORIGIN=https://tudominio.com,DB_SERVER=financialfibot.database.windows.net,1433,DB_DATABASE=<db>,DB_USER=<user>,DB_PASSWORD=<pass>}"
```

3. Conectar frontend en `.env`:

```bash
VITE_AI_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod/chat
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_AI_AUTH_HEADER=Authorization
```

## Actualización de código

```bash
npm run build:proxy
npm run package:proxy
aws lambda update-function-code --function-name fibot-ai-proxy --zip-file fileb://backend-proxy/lambda.zip
```

## Recomendaciones de seguridad

- Guarda `AI_API_KEY` y `DB_PASSWORD` en AWS Secrets Manager o SSM Parameter Store.
- Restringe `ALLOWED_ORIGIN` a tu dominio real.
- Habilita CloudWatch Logs y alertas de error.
