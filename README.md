# FiBot — Asistente Financiero

Interfaz de FiBot construida con React, TypeScript, Tailwind CSS y Vite, acompañada de un proxy de backend desplegable en **Azure Functions** o **AWS Lambda** que conecta con **Azure SQL Server** para responder preguntas financieras con datos reales.

## Tabla de contenido

- [Arquitectura general](#arquitectura-general)
- [Stack técnico](#stack-técnico)
- [Requisitos](#requisitos)
- [Inicio rápido](#inicio-rápido)
- [Scripts disponibles](#scripts-disponibles)
- [Frontend](#frontend)
- [Backend Proxy](#backend-proxy)
- [Variables de entorno del frontend](#variables-de-entorno-del-frontend)
- [Temas (Light/Dark)](#temas-lightdark)
- [Renderizado de mensajes](#renderizado-de-mensajes)
- [Calidad y pruebas](#calidad-y-pruebas)
- [Buenas prácticas para contribuir](#buenas-prácticas-para-contribuir)
- [Troubleshooting](#troubleshooting)

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USUARIO (Navegador)                        │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    FIBOT FRONTEND (React + Vite)                │   │
│   │                                                                 │   │
│   │  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────┐  │   │
│   │  │ Sidebar  │  │  ChatTimeline │  │  TopBar   │  │ Composer │  │   │
│   │  │ (models) │  │  (messages)  │  │ (session) │  │ (input)  │  │   │
│   │  └──────────┘  └──────────────┘  └───────────┘  └──────────┘  │   │
│   │                          │                                      │   │
│   │                   src/services/ai.ts                            │   │
│   │                  HTTP POST /chat (JSON)                         │   │
│   └──────────────────────────┼──────────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
              ┌────────────────┴──────────────────┐
              │                                   │
              ▼                                   ▼
  ┌───────────────────────┐          ┌────────────────────────┐
  │  Azure Functions v4   │    OR    │     AWS Lambda         │
  │  (azure-function.zip) │          │     (lambda.zip)       │
  └───────────┬───────────┘          └──────────┬─────────────┘
              │                                 │
              └────────────────┬────────────────┘
                               │
                     processRequest() — lógica compartida
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌──────────────┐  ┌────────────────┐  ┌──────────────┐
    │  AI Provider │  │  Azure SQL     │  │  AI Provider │
    │  (SQL Model) │  │  Server        │  │(Answer Model)│
    └──────────────┘  └────────────────┘  └──────────────┘
```

### Flujo de una pregunta financiera

```
Usuario: "¿Cuáles fueron los ingresos de enero 2025?"
    │
    ▼
[1] Frontend → POST /chat  (historial de mensajes)
    │
    ▼
[2] Proxy: clasifica intención → DATA o CONVERSATIONAL
    │
    ├── CONVERSATIONAL → AI genera respuesta directa (sin BD)
    │
    └── DATA
         │
         ▼
        [3] Descubrir esquema  (INFORMATION_SCHEMA.COLUMNS)
         │
         ▼
        [4] Generar T-SQL  (AI sqlModel + esquema descubierto)
         │
         ▼
        [5] Validar SQL  (SELECT-only, whitelist esquema/tablas, sin DML)
         │
         ▼
        [6] Ejecutar en Azure SQL Server
         │
         ▼
        [7] Generar respuesta HTML  (AI answerModel + datos JSON)
         │
         ▼
        [8] Frontend renderiza HTML enriquecido con DOMPurify + marked
```

---

## Stack técnico

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| React | 19 | UI declarativa |
| TypeScript | 5 | Tipado estático |
| Vite | 8 | Bundler y dev server |
| Tailwind CSS | 3 | Estilos utilitarios |
| marked | latest | Renderizado Markdown |
| DOMPurify | 3 | Sanitización XSS |
| Vitest + Testing Library | latest | Pruebas unitarias |
| Playwright | latest | Pruebas E2E |

### Backend Proxy

| Tecnología | Versión | Rol |
|---|---|---|
| TypeScript / Node.js | 20 | Runtime |
| mssql | 12 | Conexión Azure SQL Server |
| @azure/functions | 4 | Adaptador Azure Functions |
| Azure Functions v4 | — | Plataforma serverless (opción A) |
| AWS Lambda | — | Plataforma serverless (opción B) |

---

## Requisitos

- **Node.js** 20+
- **npm** 10+
- Para el proxy: cuenta en Azure o AWS con permisos de despliegue

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables del frontend
cp .env.example .env
# Editar .env con VITE_AI_API_URL apuntando al endpoint del proxy

# 3. Levantar frontend local
npm run dev
# → http://localhost:5173
```

Para levantar el proxy localmente ver la sección [Backend Proxy](#backend-proxy).

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de producción (TypeScript + Vite) |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run format` | Prettier sobre todo el proyecto |
| `npm run test` | Pruebas unitarias (Vitest) |
| `npm run test:watch` | Pruebas unitarias en modo watch |
| `npm run test:e2e` | Pruebas E2E (Playwright) |
| `npm run build:proxy` | Compila TypeScript del proxy → `backend-proxy/dist/index.js` |
| `npm run package:proxy` | Empaqueta para AWS Lambda → `backend-proxy/lambda.zip` |
| `npm run package:azure` | Empaqueta para Azure Functions → `backend-proxy/azure-function.zip` |

---

## Frontend

### Estructura de directorios

```
src/
├── app/                   → App.tsx (composición raíz)
├── components/
│   ├── chat/              → ChatTimeline, burbujas, composer, disclaimer
│   ├── layout/            → Shell, Sidebar, TopBar, estados de sesión
│   └── models/            → Selector de modelos e ítems
├── data/                  → Contenido estático y mock data
├── services/              → Cliente HTTP (src/services/ai.ts)
├── styles/                → Estilos globales
└── types/                 → Tipos de dominio UI
tests/
├── unit/                  → Pruebas unitarias (Vitest)
└── e2e/                   → Pruebas end-to-end (Playwright)
```

### Flujo de interacción

1. El usuario escribe un mensaje en el composer.
2. El mensaje se agrega al timeline y aparece el indicador de pensamiento animado.
3. `src/services/ai.ts` envía el historial completo al proxy via HTTP POST.
4. La respuesta llega como HTML enriquecido y se renderiza con `marked` + `DOMPurify`.
5. El indicador de pensamiento desaparece y el mensaje del asistente queda en el timeline.

### Indicador de pensamiento

Mientras el asistente genera su respuesta, el timeline muestra una burbuja **"Asistente está pensando"** con tres puntos animados (bounce). Es accesible (`aria-live="polite"`) y desaparece automáticamente al recibir respuesta.

### Renderizado enriquecido

- **Markdown**: tablas, listas, negritas, código.
- **HTML directo**: respuestas HTML del proxy se renderizan tal cual.
- **Sanitización XSS**: `DOMPurify` filtra todo contenido antes de insertarlo en el DOM.
- **Gráficos QuickChart**: bloques ` ```mermaid ` con datasets se convierten en imágenes `<img>` de `quickchart.io`.

---

## Backend Proxy

El proxy vive en `backend-proxy/` y comparte el mismo código fuente compilado para ambas plataformas. Consulta la guía completa en [backend-proxy/README.md](backend-proxy/README.md).

### Plataformas soportadas

| Plataforma | Paquete | Activación |
|---|---|---|
| **Azure Functions v4** | `azure-function.zip` | `@azure/functions` presente en `node_modules` |
| **AWS Lambda** | `lambda.zip` | fallback cuando `@azure/functions` no está |

### Modos de operación

**Sin base de datos configurada** — el proxy actúa como relay seguro: protege la API key del proveedor IA sin exponer credenciales al navegador.

**Con Azure SQL Server** — flujo agente completo de 5 pasos:
1. Descubrimiento de esquema (`INFORMATION_SCHEMA.COLUMNS`)
2. Clasificación de intención (DATA vs CONVERSATIONAL)
3. Generación de T-SQL seguro (AI sqlModel)
4. Validación y ejecución en Azure SQL
5. Generación de respuesta HTML (AI answerModel)

### Compilar y desplegar

```bash
# 1. Compilar TypeScript
npm run build:proxy

# 2a. Empaquetar para Azure Functions
npm run package:azure
# → backend-proxy/azure-function.zip

# 2b. Empaquetar para AWS Lambda
npm run package:proxy
# → backend-proxy/lambda.zip

# 3a. Desplegar en Azure (requiere Azure CLI)
az functionapp deployment source config-zip `
  --resource-group <resource-group> `
  --name <function-app-name> `
  --src backend-proxy/azure-function.zip

# 3b. Desplegar en AWS Lambda
aws lambda update-function-code \
  --function-name fibot-ai-proxy \
  --zip-file fileb://backend-proxy/lambda.zip
```

### Modos de conexión a Azure SQL

El proxy detecta automáticamente el modo según las variables presentes:

| Modo | Variables requeridas |
|---|---|
| Connection String | `DB_CONNECTION_STRING` |
| SQL Auth | `DB_SERVER` + `DB_DATABASE` + `DB_USER` + `DB_PASSWORD` |
| Service Principal | `DB_SERVER` + `DB_DATABASE` + `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` |

---

## Variables de entorno del frontend

Define en tu archivo `.env` (nunca subir al repositorio):

| Variable | Descripción |
|---|---|
| `VITE_AI_API_URL` | URL del endpoint del proxy (`/api/chat` en Azure o API Gateway en Lambda) |
| `VITE_AI_API_KEY` | API key (solo si el frontend llama directo al proveedor IA sin proxy) |
| `VITE_AI_MODEL` | Modelo por defecto (opcional) |
| `VITE_AI_AUTH_HEADER` | Header de autenticación (opcional, default `Authorization`) |

Con el proxy desplegado, `VITE_AI_API_URL` apunta al endpoint del proxy y las credenciales sensibles viven en las variables de entorno del servidor, no en el frontend.

---

## Temas (Light/Dark)

- Toggle manual en el Top Bar.
- Persistencia en `localStorage` (key `fibot-theme`).
- Implementado con Tailwind `darkMode: 'class'`.
- Transiciones suaves con soporte para `prefers-reduced-motion`.

---

## Renderizado de mensajes

Los mensajes del asistente aceptan:

- **Markdown** via `marked`: tablas, listas, código, negritas.
- **HTML**: renderizado directo con sanitización DOMPurify.
- **QuickChart**: bloques `mermaid` con datasets `"Label": [valores]` → imagen de gráfico de barras.

---

## Calidad y pruebas

```bash
# Ejecutar antes de subir cambios
npm run lint
npm run test
npm run test:e2e
npm run build
```

### Cobertura actual

**Unit tests (Vitest)**:
- Visibilidad del estado superior
- Flujo de envío de chat
- Bloqueo de envío vacío
- Estado de modelos en sidebar
- Persistencia y toggle de tema

**E2E tests (Playwright)**:
- Flujo smoke de envío de mensaje
- Medición base de interacción/performance

---

## Buenas prácticas para contribuir

- Textos de UI en español, consistentes con el sistema actual.
- Cambios pequeños y enfocados — un PR por feature o fix.
- Añadir pruebas al modificar flujos críticos.
- Usar tokens y utilidades Tailwind existentes; evitar estilos hardcodeados.
- Nunca insertar HTML en el DOM sin pasar por `DOMPurify`.
- Nunca commitear `.env`, `local.settings.json` ni credenciales.

---

## Troubleshooting

### `npm install` falla

Verifica Node.js 20+. Elimina `node_modules` y `package-lock.json` y reinstala.

### Las pruebas E2E fallan en entorno nuevo

```bash
npx playwright install
```

### El tema no cambia

- Verifica `fibot-theme` en `localStorage`.
- Confirma `darkMode: 'class'` en `tailwind.config.js`.

### Los gráficos QuickChart no se muestran

- Verifica conectividad a `quickchart.io`.
- La IA debe generar bloques `mermaid` con formato `"Label": [valores]`.

### El proxy no conecta a Azure SQL

- Verifica las variables `DB_*` en la configuración del servidor (Application Settings en Azure, env vars en Lambda).
- Confirma que la IP del servidor (o NAT Gateway en Lambda) esté en la whitelist del firewall de Azure SQL.
- Para Lambda: se requiere VPC + NAT Gateway con Elastic IP fija; "Allow Azure services" no cubre AWS.
- Revisa los logs en Application Insights (Azure) o CloudWatch (Lambda).

### Guía completa del proxy

Ver [backend-proxy/README.md](backend-proxy/README.md) para documentación detallada de variables, modos de conexión, seguridad SQL y opciones de despliegue.

---

## Análisis del sistema

### Performance

| Dimensión | Estado actual | Impacto | Recomendación |
|---|---|---|---|
| Latencia total | 3–8 s (flujo SQL completo) | Alto | Mostrar streaming de tokens si el proveedor IA lo soporta |
| Etapas IA en serie | 2 llamadas (SQL → respuesta) | Medio | Cachear `discoverSchemaHint` por sesión si el esquema no cambia |
| Timeout SQL | 30 s (configurable) | Bajo | Ajustar a la complejidad real de las consultas; 30 s es conservador |
| Filas al modelo | 100 (configurable) | Medio-alto | `DB_MAX_ROWS=50` reduce tokens y latencia de la segunda llamada IA |
| Cold start serverless | 1–3 s adicionales | Medio | Plan Premium elimina cold starts en Azure Functions |
| Tamaño del paquete | `mssql` ~15 MB | Bajo | Normal para Node.js; no impacta latencia de ejecución |

### Arquitectura

| Dimensión | Estado actual | Fortaleza / Riesgo |
|---|---|---|
| Dual-platform adapter | Un solo `dist/index.js` para Azure y Lambda | Fortaleza: reduce duplicación; riesgo: `require('@azure/functions')` con try/catch |
| Separación de responsabilidades | `processRequest()` agnóstica a la plataforma | Fortaleza: testeable de forma aislada |
| Conversational routing | La misma llamada IA clasifica Y genera SQL | Fortaleza: ahorra llamada extra; riesgo: el modelo puede malclasificar |
| Schema discovery por request | `INFORMATION_SCHEMA.COLUMNS` en cada mensaje | Riesgo: consulta extra a la BD; mitigable con caché en memoria |
| Retry on `Invalid object name` | Un reintento con redescubrimiento de esquema | Razonable; más reintentos aumentarían la latencia |
| Stateless | Sin estado compartido entre requests | Fortaleza: escala horizontalmente sin coordinación |

### Seguridad

| Capa | Estado | Nivel |
|---|---|---|
| API key nunca expuesta al navegador | Proxy protege todas las credenciales | Excelente |
| SQL injection | SELECT-only, DML blocklist, esquema explícito, whitelist de tablas | Excelente |
| Comentarios SQL bloqueados | `--`, `/*`, `*/` rechazados | Excelente |
| CORS | `ALLOWED_ORIGIN` configurable | Bueno — usar dominio exacto en producción, no `*` |
| Usuario de BD | Recomendado: permisos solo SELECT sobre el esquema permitido | Pendiente validar en la BD |
| Secretos en variables de entorno | No hardcodeados en código ni repositorio | Excelente |
| `local.settings.json` en `.gitignore` | No se sube al repositorio | Excelente |
| HTML sanitizado con DOMPurify | Previene XSS en respuestas del asistente | Excelente |
| Rate limiting | No implementado en el proxy | Riesgo — agregar en Azure API Management o AWS API Gateway |

### Observabilidad

| Dimensión | Estado | Recomendación |
|---|---|---|
| Logs | `console.error` en catch blocks | Agregar Application Insights (Azure) o CloudWatch structured logs |
| Trazabilidad | Sin request ID | Generar y propagar un `X-Request-Id` para correlacionar frontend y proxy |
| Métricas por etapa | Sin instrumentación | Registrar duración de schema discovery, SQL gen, SQL exec y answer gen |
| Alertas | Sin configurar | Crear alerta por error rate > 5% en Application Insights / CloudWatch |

### Mantenibilidad

| Dimensión | Estado | Observación |
|---|---|---|
| TypeScript strict | Habilitado | Reduce bugs en tiempo de compilación |
| Tests del proxy | Ninguno | Vitest cubre solo el frontend; el proxy no tiene suite propia |
| Scripts de packaging | PowerShell (.ps1) | Funciona en Windows; agregar equivalente bash para CI/CD en Linux |
| Dependencias | `mssql 12`, `@azure/functions 4` | Mantener actualizados para recibir parches de seguridad |
| Documentación | README por capa (raíz + backend-proxy) | Reduce fricción de onboarding |

### Costos estimados (referencia)

| Componente | Azure Functions (Consumption) | AWS Lambda |
|---|---|---|
| Invocaciones | 1 M gratis/mes, luego ~$0.20/M | 1 M gratis/mes, luego ~$0.20/M |
| Duración | 400 000 GB-s gratis/mes | 400 000 GB-s gratis/mes |
| Azure SQL | ~$5/mes (Basic 5 DTU) — $150+/mes (General Purpose) | misma BD, sin cambio |
| IP fija | Incluida en Azure Functions (misma VNet) | NAT Gateway ~$32/mes fijos + datos |
| **Ventaja** | Sin NAT Gateway, latencia BD menor (misma región) | Mayor flexibilidad de proveedor |
