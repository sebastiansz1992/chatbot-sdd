# Backend Proxy AWS Lambda (TypeScript)

Este proxy protege la API key del proveedor de IA y soporta un flujo de agente con SQL Server:

1. Clasifica automáticamente si la pregunta requiere datos o es conversacional.
2. Si requiere datos: la IA convierte la pregunta a SQL → Lambda ejecuta la consulta → la IA genera la respuesta final.
3. Si es conversacional (saludos, ¿qué puedes hacer?, conceptos financieros): responde directamente sin SQL.

## Arquitectura recomendada

- Frontend React en S3 + CloudFront.
- Proxy en AWS Lambda.
- Exposición vía API Gateway (HTTP API).

## Variables de entorno de Lambda

### IA

| Variable | Requerida | Descripción |
|---|---|---|
| `AI_API_URL` | Sí | Endpoint del proveedor IA |
| `AI_API_KEY` | Recomendada | Token o API key |
| `AI_MODEL` | No | Modelo por defecto |
| `AI_AUTH_HEADER` | No | Header de auth, default `Authorization` |
| `AI_PROVIDER` | No | `openai-compatible` (default) o `gemini` |
| `AI_SQL_MODEL` | No | Modelo para etapa pregunta→SQL |
| `AI_ANSWER_MODEL` | No | Modelo para etapa resultados→respuesta |
| `ALLOWED_ORIGIN` | No | Origen CORS, ej: `https://tudominio.com` |

### Base de datos SQL Server

| Variable | Descripción |
|---|---|
| `DB_CONNECTION_STRING` | Cadena de conexión completa (Modo 1) |
| `DB_SERVER` | Host del servidor, ej: `financialfibot.database.windows.net,1433` |
| `DB_DATABASE` | Nombre de la base de datos |
| `DB_USER` | Usuario SQL auth (Modo 2) |
| `DB_PASSWORD` | Contraseña SQL auth (Modo 2) |
| `AZURE_TENANT_ID` | Tenant Entra ID (Modo 3 Service Principal) |
| `AZURE_CLIENT_ID` | Application (client) ID (Modo 3) |
| `AZURE_CLIENT_SECRET` | Client secret (Modo 3) |
| `DB_ALLOWED_SCHEMA` | Esquema SQL permitido. Default: `dbo` |
| `DB_ALLOWED_TABLES` | Tablas/vistas permitidas, separadas por coma. Vacío = todas en el esquema |
| `DB_ALLOWED_TABLE` | Tabla única permitida (legado, usar `DB_ALLOWED_TABLES`) |
| `DB_SCHEMA_HINT` | Contexto adicional de negocio para el modelo SQL |
| `DB_MAX_ROWS` | Límite de filas retornadas. Default: `100` |
| `DB_TIMEOUT_SECONDS` | Timeout de consulta SQL. Default: `30` |

### Modos de conexión a SQL Server

**Modo 1 — Connection String (prioridad máxima):**
```
DB_CONNECTION_STRING=Server=tcp:financialfibot.database.windows.net,1433;Database=midb;User ID=financialfibot;Password=<pass>;Encrypt=true;TrustServerCertificate=false;
```

**Modo 2 — SQL Auth (usuario/contraseña):**
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
DB_USER=financialfibot
DB_PASSWORD=<pass>
```

**Modo 3 — Service Principal (Azure AAD):**
```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<client-secret>
```

Sin configuración de BD → el proxy opera en modo chat directo (sin SQL).

## Flujo de conversación

El bot detecta automáticamente el tipo de pregunta:

| Tipo de pregunta | Ejemplo | Comportamiento |
|---|---|---|
| Saludo | "Hola, buenos días" | Responde conversacionalmente |
| Capacidades | "¿Qué reportes puedes darme?" | Lista los reportes disponibles |
| Conceptos | "¿Qué es el EBITDA?" | Explica el concepto |
| Datos | "¿Cuáles fueron los ingresos de enero?" | Genera SQL → ejecuta → responde |

## Configuración para la base de datos financiera

Para el esquema `finanzas` (con tablas dim/fact/vw):

```
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
DB_USER=financialfibot
DB_PASSWORD=<pass>
DB_ALLOWED_SCHEMA=finanzas
DB_ALLOWED_TABLES=fact_movimientos_contables,fact_presupuesto,fact_cartera_clientes,fact_recaudos,fact_cuentas_por_pagar,fact_pagos_proveedores,fact_flujo_caja,fact_saldos_bancarios,fact_inventarios,fact_ventas,fact_deuda_financiera,fact_impuestos,dim_empresas,dim_tiempo,dim_cuentas_contables,dim_terceros,dim_centros_costo,dim_productos_servicios,dim_monedas,dim_escenarios,vw_estado_resultados,vw_balance_general,vw_flujo_caja,vw_real_vs_presupuesto,vw_kpis_financieros
DB_MAX_ROWS=200
DB_TIMEOUT_SECONDS=45
```

Si omites `DB_ALLOWED_TABLES`, el bot puede consultar cualquier tabla del esquema `finanzas` automáticamente.

## Ejemplos completos

### Azure SQL + Gemini (SQL auth, esquema finanzas)

```
AI_PROVIDER=gemini
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<TU_GEMINI_API_KEY>
AI_AUTH_HEADER=x-goog-api-key
ALLOWED_ORIGIN=https://tu-dominio-frontend.com
DB_SERVER=financialfibot.database.windows.net,1433
DB_DATABASE=midb
DB_USER=financialfibot
DB_PASSWORD=<pass>
DB_ALLOWED_SCHEMA=finanzas
DB_MAX_ROWS=200
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

```bash
npm run build:proxy
```

Salida: `backend-proxy/dist/index.js`

## Empaquetar para Lambda

```bash
npm run package:proxy
```

Genera `backend-proxy/lambda.zip` con `index.js` y dependencias runtime.

## Configuración de Lambda

- Runtime: `Node.js 20.x`
- Handler: `index.handler`
- Compila a CommonJS

## Despliegue

```bash
npm run build:proxy
npm run package:proxy
aws lambda update-function-code --function-name fibot-ai-proxy --zip-file fileb://backend-proxy/lambda.zip
```

## Recomendaciones de seguridad

- Guarda `AI_API_KEY` y `DB_PASSWORD` en AWS Secrets Manager o SSM Parameter Store.
- Restringe `ALLOWED_ORIGIN` a tu dominio real.
- Define `DB_ALLOWED_SCHEMA` y `DB_ALLOWED_TABLES` para limitar el acceso a datos.
- Habilita CloudWatch Logs y alertas de error.
