# FiBot Frontend

Interfaz de FiBot (asistente financiero) construida con React, TypeScript, Tailwind CSS y Vite.

El proyecto está enfocado en una experiencia de chat financiera moderna, con selección de modelos de IA, estados de sesión/seguridad, soporte de tema claro/oscuro y pruebas automatizadas unitarias + E2E.

## Tabla de contenido

- [Resumen](#resumen)
- [Stack técnico](#stack-técnico)
- [Requisitos](#requisitos)
- [Inicio rápido](#inicio-rápido)
- [Scripts disponibles](#scripts-disponibles)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Flujo funcional actual](#flujo-funcional-actual)
- [Integración con IA (TypeScript)](#integración-con-ia-typescript)
- [Renderizado de mensajes del asistente](#renderizado-de-mensajes-del-asistente)
- [Indicador de pensamiento del asistente](#indicador-de-pensamiento-del-asistente)
- [Backend proxy y Data Fabric](#backend-proxy-y-data-fabric)
- [Temas (Light/Dark)](#temas-lightdark)
- [Iconografía de FiBot y agentes](#iconografía-de-fibot-y-agentes)
- [Calidad y pruebas](#calidad-y-pruebas)
- [Buenas prácticas para contribuir](#buenas-prácticas-para-contribuir)
- [Troubleshooting](#troubleshooting)

## Resumen

FiBot Frontend ofrece:

- **Chat financiero interactivo** con timeline de mensajes y envío de prompts.
- **Selector de modelos de IA** con estado activo.
- **Indicadores de seguridad/sesión** en la barra superior.
- **Tema claro/oscuro manual** con persistencia en `localStorage`.
- **UI en español** en textos principales y etiquetas de accesibilidad.
- **Renderizado enriquecido** de respuestas del asistente (HTML, Markdown y gráficos QuickChart).
- **Indicador de pensamiento** animado mientras el asistente genera una respuesta.
- **Integración con Data Fabric** mediante flujo agente SQL en el backend proxy.
- **Pruebas automatizadas** para validar comportamiento y regresiones.

## Stack técnico

- **React 19**
- **TypeScript 5**
- **Vite 8**
- **Tailwind CSS 3**
- **marked** (renderizado Markdown)
- **DOMPurify** (sanitización HTML)
- **Vitest + Testing Library** (unitarias)
- **Playwright** (end-to-end)
- **ESLint + Prettier**

## Requisitos

- **Node.js** 20+ recomendado
- **npm** 10+ recomendado

## Inicio rápido

1. Instalar dependencias:

	 ```bash
	 npm install
	 ```

2. Levantar ambiente local:

	 ```bash
	 npm run dev
	 ```

3. Abrir en navegador:

	 - Vite mostrará una URL local (normalmente `http://localhost:5173`).

## Scripts disponibles

- Desarrollo:

	```bash
	npm run dev
	```

- Build de producción:

	```bash
	npm run build
	```

- Preview del build:

	```bash
	npm run preview
	```

- Lint:

	```bash
	npm run lint
	```

- Formato:

	```bash
	npm run format
	```

- Tests unitarios:

	```bash
	npm run test
	```

- Tests E2E:

	```bash
	npm run test:e2e
	```

- Compilar backend proxy:

	```bash
	npm run build:proxy
	```

- Empaquetar backend proxy (genera `lambda.zip`):

	```bash
	npm run package:proxy
	```

## Arquitectura del proyecto

Estructura principal:

- `src/app` → composición de la aplicación (`App.tsx`).
- `src/components/chat` → timeline, burbujas, disclaimer y composer.
- `src/components/layout` → shell, sidebar, top bar y estados de sesión.
- `src/components/models` → selector de modelos e ítems.
- `src/data` → contenido estático y mock data.
- `src/services` → cliente HTTP para comunicación con el proveedor de IA.
- `src/styles` → estilos globales.
- `src/types` → tipos de dominio de UI.
- `backend-proxy` → proxy AWS Lambda con soporte de Data Fabric.
- `tests/unit` → pruebas unitarias de comportamiento.
- `tests/e2e` → pruebas end-to-end con Playwright.

## Flujo funcional actual

1. El usuario abre la app y visualiza:
	 - Sidebar con marca FiBot.
	 - Modelos de IA disponibles.
	 - Barra superior con estado de seguridad/sesión.
2. El usuario escribe un mensaje en el composer.
3. La app valida que el input no esté vacío.
4. El mensaje se agrega al timeline y se muestra el indicador de pensamiento animado.
5. Se llama al backend proxy, que puede responder directamente o ejecutar el flujo Data Fabric (SQL → resultados → respuesta).
6. La respuesta del asistente se renderiza con HTML/Markdown enriquecido y gráficos QuickChart si corresponde.
7. Se mantiene visible el disclaimer financiero.

## Integración con IA (TypeScript)

El chat ya está integrado con un cliente TypeScript para consultar un proveedor de IA vía HTTP.

### Cómo configurarlo

1. Crea tu archivo local de entorno:

	```bash
	cp .env.example .env
	```

2. Define variables en `.env`:

	- `VITE_AI_API_URL`: URL del endpoint de chat/completions.
	- `VITE_AI_API_KEY`: token o API key.
	- `VITE_AI_MODEL`: modelo a utilizar (opcional).
	- `VITE_AI_AUTH_HEADER`: header de auth (opcional, por defecto `Authorization`).

### Flujo al enviar mensaje

- Se agrega inmediatamente el mensaje del usuario en la conversación.
- Se muestra el indicador de pensamiento animado mientras se espera respuesta.
- Se envía el historial al endpoint configurado.
- La respuesta del asistente se renderiza con HTML/Markdown enriquecido.
- Si falla la llamada, se muestra un mensaje de error del asistente.

### Nota sobre Copilot

Si quieres usar un servicio asociado a tu suscripción de Copilot, debes exponer o usar un endpoint HTTP compatible con este frontend y mapearlo en `VITE_AI_API_URL`.

### Backend proxy recomendado

En este repositorio tienes un proxy listo para AWS Lambda en `backend-proxy`.

- Guía completa: `backend-proxy/README.md`.
- El frontend puede apuntar al endpoint de API Gateway generado por ese proxy.

## Renderizado de mensajes del asistente

Los mensajes del asistente se renderizan con contenido enriquecido mediante:

- **Markdown** (`marked`) con soporte de tablas, listas, negritas, código y más.
- **HTML directo**: si la respuesta ya contiene etiquetas HTML, se renderiza tal cual.
- **Sanitización** con `DOMPurify` para prevenir ataques XSS antes de insertar en el DOM.
- **Gráficos QuickChart**: los bloques `mermaid` del tipo gráfico de barras son automáticamente convertidos a imágenes `<img>` generadas por QuickChart (`quickchart.io`).

### Conversión de gráficos Mermaid a QuickChart

Si la IA responde con un bloque de código ` ```mermaid ` conteniendo datos con datasets en formato `"Label": [valores]`, el frontend lo transforma automáticamente en un gráfico de barras renderizado como imagen.

Esto permite mostrar visualizaciones financieras sin depender de librerías de gráficos del lado cliente.

## Indicador de pensamiento del asistente

Mientras el asistente genera su respuesta, el `ChatTimeline` muestra una burbuja con el texto **"Asistente está pensando"** acompañada de tres puntos animados (bounce). Este indicador:

- Es accesible (`aria-live="polite"`, `aria-label` descriptivo).
- Desaparece automáticamente cuando llega la respuesta.
- Tiene soporte para tema claro y oscuro.

## Backend proxy y Data Fabric

El proxy Lambda en `backend-proxy/` soporta dos modos de operación:

### Modo chat directo

Sin variables de Data Fabric configuradas, el proxy actúa como un relay seguro entre el frontend y el proveedor de IA, protegiendo la API key.

### Modo agente Data Fabric

Cuando se configura `DATA_FABRIC_CONNECTION_STRING` o las variables de App Registration, el proxy ejecuta un flujo agente completo:

1. **Pregunta → SQL**: la IA convierte la pregunta del usuario a T-SQL para Microsoft Fabric Warehouse.
2. **Validación SQL**: se aplican validaciones de solo lectura (SELECT/WITH), palabras clave peligrosas, esquema y tabla permitida.
3. **Descubrimiento de esquema**: consulta automática a `INFORMATION_SCHEMA.COLUMNS` para enriquecer el contexto de generación SQL.
4. **Ejecución SQL**: se ejecuta la consulta en Fabric con timeout configurable.
5. **Retry automático**: si la primera ejecución falla por tabla inválida, el proxy regenera el SQL con el esquema descubierto.
6. **Resultados → Respuesta**: la IA genera la respuesta final en HTML enriquecido con base en los datos obtenidos.

### Variables de entorno del proxy

- `AI_API_URL` (requerido): endpoint del proveedor IA.
- `AI_API_KEY` (opcional/recomendado): token o API key.
- `AI_MODEL` (opcional): modelo por defecto.
- `AI_AUTH_HEADER` (opcional): por defecto `Authorization`.
- `AI_PROVIDER` (opcional): `openai-compatible` (default) o `gemini`.
- `AI_SQL_MODEL` (opcional): modelo para la etapa pregunta→SQL.
- `AI_ANSWER_MODEL` (opcional): modelo para la etapa resultados→respuesta final.
- `ALLOWED_ORIGIN` (opcional): origen permitido para CORS.
- `DATA_FABRIC_CONNECTION_STRING` (opcional): cadena de conexión SQL de Microsoft Fabric.
- `DATA_FABRIC_SERVER` (opcional): host de Fabric Warehouse.
- `DATA_FABRIC_DATABASE` (opcional): nombre de base de datos/warehouse.
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (opcional): App Registration para autenticación sin connection string.
- `DATA_FABRIC_ALLOWED_SCHEMA` (opcional): esquema permitido, default `dbo`.
- `DATA_FABRIC_ALLOWED_TABLE` (opcional): tabla permitida para consultas generadas.
- `DATA_FABRIC_SCHEMA_HINT` (opcional): contexto adicional de tablas/columnas para mejorar SQL.
- `DATA_FABRIC_MAX_ROWS` (opcional): límite de filas, default `100`.
- `DATA_FABRIC_TIMEOUT_SECONDS` (opcional): timeout de consulta SQL, default `30`.

Consulta `backend-proxy/README.md` para guía completa de despliegue, configuración y ejemplos.

## Temas (Light/Dark)

La app soporta tema claro y oscuro mediante Tailwind con estrategia por clase (`darkMode: 'class'`).

### Comportamiento

- Hay un **toggle manual** en el Top Bar.
- El tema seleccionado se guarda en `localStorage` con la key `fibot-theme`.
- En cada cambio de tema:
	- Se agrega o quita la clase `dark` en `document.documentElement`.
	- Se persiste la preferencia del usuario.

### Experiencia visual

- Transiciones suaves de color para el cambio de tema.
- Respeto por accesibilidad con `prefers-reduced-motion: reduce`.

## Iconografía de FiBot y agentes

Se incorporó iconografía semántica en el área izquierda:

- **FiBot**: ícono representativo en el encabezado del sidebar.
- **Agentes IA**: ícono por modelo en cada tarjeta de selección.
- **Acentos por proveedor**: OpenAI, Anthropic y Google con tonos sutiles para diferenciación visual.

## Calidad y pruebas

El proyecto incluye cobertura de flujos clave:

- **Unit tests**:
	- Visibilidad del estado superior.
	- Flujo de envío de chat.
	- Bloqueo de envío vacío.
	- Estado de modelos en sidebar.
	- Persistencia y toggle de tema.
- **E2E tests**:
	- Flujo smoke de envío de mensaje.
	- Medición base de interacción/performance.

Ejecución recomendada antes de subir cambios:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Buenas prácticas para contribuir

- Mantener los textos de UI en español y consistentes.
- Preferir cambios pequeños y enfocados.
- Añadir o ajustar pruebas cuando se modifiquen flujos críticos.
- Respetar tokens/utilidades de Tailwind ya existentes.
- Evitar introducir estilos hardcodeados fuera del sistema actual.
- No devolver HTML sin sanitizar con DOMPurify antes de insertar en el DOM.

## Troubleshooting

### 1) `npm install` falla

- Verifica versión de Node.js.
- Elimina `node_modules` y `package-lock.json`, luego reinstala:

	```bash
	npm install
	```

### 2) Las pruebas E2E fallan en entorno nuevo

- Instala navegadores de Playwright:

	```bash
	npx playwright install
	```

### 3) El tema no cambia

- Verifica que exista la key `fibot-theme` en `localStorage`.
- Revisa que `darkMode: 'class'` esté definido en `tailwind.config.js`.

### 4) Los gráficos QuickChart no se muestran

- Verifica conectividad a `quickchart.io` desde el navegador.
- Asegúrate de que la IA esté generando bloques `mermaid` con el formato esperado (`"Label": [valores]`).

### 5) El flujo Data Fabric falla

- Verifica que `DATA_FABRIC_CONNECTION_STRING` o las variables de App Registration estén correctamente configuradas en Lambda.
- Confirma que el Service Principal tenga permisos de acceso y lectura sobre el Warehouse en Microsoft Fabric.
- Revisa los logs de CloudWatch para ver el error exacto de conexión o SQL.
