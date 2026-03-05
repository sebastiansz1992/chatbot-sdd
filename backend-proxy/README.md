# Backend Proxy AWS Lambda (TypeScript)

Este proxy permite proteger la API key del proveedor de IA y exponer un endpoint HTTP para el frontend.

## Arquitectura recomendada

- Frontend React en S3 + CloudFront.
- Proxy en AWS Lambda.
- Exposición vía API Gateway (HTTP API).

## Variables de entorno de Lambda

- `AI_API_URL` (requerido): endpoint del proveedor IA.
- `AI_API_KEY` (opcional/recomendado): token o API key.
- `AI_MODEL` (opcional): modelo por defecto.
- `AI_AUTH_HEADER` (opcional): por defecto `Authorization`.
- `ALLOWED_ORIGIN` (opcional): origen permitido para CORS, por ejemplo `https://tudominio.com`.

## Compilar

Desde la raíz del proyecto:

```bash
npm run build:proxy
```

Salida compilada:

- `backend-proxy/dist/index.js`

## Empaquetar para Lambda

```bash
Compress-Archive -Path backend-proxy/dist/* -DestinationPath backend-proxy/lambda.zip -Force
```

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
Compress-Archive -Path backend-proxy/dist/* -DestinationPath backend-proxy/lambda.zip -Force
aws lambda update-function-code --function-name fibot-ai-proxy --zip-file fileb://backend-proxy/lambda.zip
```

## Recomendaciones de seguridad

- Guarda `AI_API_KEY` en AWS Secrets Manager o SSM Parameter Store.
- Restringe `ALLOWED_ORIGIN` a tu dominio real.
- Habilita CloudWatch Logs y alertas de error.
