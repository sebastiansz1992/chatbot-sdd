# Backend Proxy AWS Lambda (TypeScript)

Este proxy protege la API key del proveedor de IA y ahora soporta un flujo de agente con Data Fabric:

1. IA convierte pregunta del usuario a SQL.
2. Lambda ejecuta SQL en Microsoft Fabric.
3. Lambda envía resultados a la IA para generar la respuesta final.

## Arquitectura recomendada

- Frontend React en S3 + CloudFront.
- Proxy en AWS Lambda.
- Exposición vía API Gateway (HTTP API).

## Variables de entorno de Lambda

- `AI_API_URL` (requerido): endpoint del proveedor IA.
- `AI_API_KEY` (opcional/recomendado): token o API key.
- `AI_MODEL` (opcional): modelo por defecto.
- `AI_AUTH_HEADER` (opcional): por defecto `Authorization`.
- `AI_PROVIDER` (opcional): `openai-compatible` (default) o `gemini`.
- `ALLOWED_ORIGIN` (opcional): origen permitido para CORS, por ejemplo `https://tudominio.com`.
- `AI_SQL_MODEL` (opcional): modelo para etapa pregunta->SQL.
- `AI_ANSWER_MODEL` (opcional): modelo para etapa resultados->respuesta final.
- `DATA_FABRIC_CONNECTION_STRING` (opcional/recomendado): cadena de conexión SQL de Microsoft Fabric.
- `DATA_FABRIC_SERVER` (opcional): host de Fabric Warehouse, por ejemplo `xxxx.datawarehouse.fabric.microsoft.com`.
- `DATA_FABRIC_DATABASE` (opcional): nombre de base de datos/warehouse a consultar.
- `AZURE_TENANT_ID` (opcional): tenant Entra ID para Service Principal.
- `AZURE_CLIENT_ID` (opcional): Application (client) ID de App Registration.
- `AZURE_CLIENT_SECRET` (opcional): client secret de App Registration.
- `ONELAKE_WORKSPACE_NAME` (opcional): fallback para `DATA_FABRIC_DATABASE`.
- `DATA_FABRIC_SCHEMA_HINT` (opcional): contexto de tablas/columnas para mejorar SQL generado.
- `DATA_FABRIC_MAX_ROWS` (opcional): límite de filas retornadas al prompt final, default `100`.
- `DATA_FABRIC_TIMEOUT_SECONDS` (opcional): timeout de consulta SQL, default `30`.

### Modos de conexión a Data Fabric

- Modo 1 (cadena completa): usa `DATA_FABRIC_CONNECTION_STRING`.
- Modo 2 (App Registration): usa `DATA_FABRIC_SERVER` + `DATA_FABRIC_DATABASE` + `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET`.

### Ejemplo para Google Gemini

- `AI_PROVIDER=gemini`
- `AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- `AI_API_KEY=<TU_GEMINI_API_KEY>`
- `AI_AUTH_HEADER=x-goog-api-key`
- `AI_MODEL=` (vacío, porque ya va en la URL)
- `ALLOWED_ORIGIN=https://tu-dominio-frontend.com`

### Ejemplo para flujo Data Fabric

- `AI_PROVIDER=gemini`
- `AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- `AI_API_KEY=<TU_GEMINI_API_KEY>`
- `AI_AUTH_HEADER=x-goog-api-key`
- `DATA_FABRIC_CONNECTION_STRING=Server=tcp:<server>.datawarehouse.fabric.microsoft.com,1433;Database=<db>;User ID=<user>;Password=<password>;Encrypt=true;TrustServerCertificate=false;`
- `DATA_FABRIC_SCHEMA_HINT=Tabla Ventas(fecha, monto, categoria), Tabla Clientes(id, segmento)`
- `DATA_FABRIC_MAX_ROWS=100`
- `DATA_FABRIC_TIMEOUT_SECONDS=30`

### Ejemplo para flujo Data Fabric con App Registration (sin connection string)

- `AI_PROVIDER=gemini`
- `AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- `AI_API_KEY=<TU_GEMINI_API_KEY>`
- `AI_AUTH_HEADER=x-goog-api-key`
- `DATA_FABRIC_SERVER=xxxxxx-xxxxxxxx.datawarehouse.fabric.microsoft.com`
- `DATA_FABRIC_DATABASE=<NOMBRE_WAREHOUSE_O_DATABASE>`
- `AZURE_TENANT_ID=<tenant-id>`
- `AZURE_CLIENT_ID=<app-client-id>`
- `AZURE_CLIENT_SECRET=<client-secret>`
- `ONELAKE_WORKSPACE_NAME=Fibot` (opcional, fallback para database)
- `DATA_FABRIC_SCHEMA_HINT=Tabla Ventas(fecha, monto, categoria), Tabla Clientes(id, segmento)`
- `DATA_FABRIC_MAX_ROWS=100`
- `DATA_FABRIC_TIMEOUT_SECONDS=30`

## Compilar

Desde la raíz del proyecto:

```bash
npm run build:proxy
```

> Incluye `mssql` en el paquete de Lambda para poder ejecutar consultas en Fabric.

Salida compilada:

- `backend-proxy/dist/index.js`

## Empaquetar para Lambda

```bash
npm run package:proxy
```

Este comando genera `backend-proxy/lambda.zip` incluyendo `index.js` y dependencias runtime (`mssql` y transitivas), evitando errores como `Cannot find module 'mssql'`.

## Configuración correcta de Lambda

- Runtime: `Node.js 20.x`.
- Handler: `index.handler`.
- Este proyecto compila a CommonJS, por lo que evita el error `Unexpected token 'export'`.

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
  --environment "Variables={AI_API_URL=<URL>,AI_API_KEY=<KEY>,AI_MODEL=<MODEL>,ALLOWED_ORIGIN=https://tudominio.com}"
```

3. Crear API Gateway HTTP API e integración con Lambda:

```bash
aws apigatewayv2 create-api --name fibot-ai-proxy-api --protocol-type HTTP
```

Después crea:
- integración Lambda,
- ruta `POST /chat`,
- ruta `OPTIONS /chat` (o CORS automático en HTTP API),
- stage (por ejemplo `prod`).

4. Conectar frontend:

En `.env` del frontend:

```bash
VITE_AI_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod/chat
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_AI_AUTH_HEADER=Authorization
```

> Cuando usas este proxy, normalmente `VITE_AI_API_KEY` queda vacío porque la key vive solo en Lambda.

## Actualización de código

Cada despliegue nuevo:

```bash
npm run build:proxy
npm run package:proxy
aws lambda update-function-code --function-name fibot-ai-proxy --zip-file fileb://backend-proxy/lambda.zip
```

## Recomendaciones de seguridad

- Guarda `AI_API_KEY` en AWS Secrets Manager o SSM Parameter Store.
- Restringe `ALLOWED_ORIGIN` a tu dominio real.
- Habilita CloudWatch Logs y alertas de error.
