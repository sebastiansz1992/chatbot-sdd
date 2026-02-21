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
- **Pruebas automatizadas** para validar comportamiento y regresiones.

## Stack técnico

- **React 19**
- **TypeScript 5**
- **Vite 8**
- **Tailwind CSS 3**
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

## Arquitectura del proyecto

Estructura principal:

- `src/app` → composición de la aplicación (`App.tsx`).
- `src/components/chat` → timeline, burbujas, disclaimer y composer.
- `src/components/layout` → shell, sidebar, top bar y estados de sesión.
- `src/components/models` → selector de modelos e ítems.
- `src/data` → contenido estático y mock data.
- `src/styles` → estilos globales.
- `src/types` → tipos de dominio de UI.
- `tests/unit` → pruebas unitarias de comportamiento.
- `tests/e2e` → pruebas end-to-end con Playwright.

## Flujo funcional actual

1. El usuario abre la app y visualiza:
	 - Sidebar con marca FiBot.
	 - Modelos de IA disponibles.
	 - Barra superior con estado de seguridad/sesión.
2. El usuario escribe un mensaje en el composer.
3. La app valida que el input no esté vacío.
4. El mensaje se agrega al timeline.
5. Se mantiene visible el disclaimer financiero.

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

---

Si quieres, en el siguiente paso puedo añadir una sección de **Roadmap** con prioridades sugeridas (API real, auth, streaming de respuestas, métricas y observabilidad).
