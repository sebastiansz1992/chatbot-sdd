# Quickstart

## Prerequisites
- Node.js 20.x
- npm 10+
- AWS CLI (for backend deployment)
- Google Gemini API key with billing enabled

## Frontend Commands
- `npm install`
- `npm run dev` — start local dev server
- `npm run lint` — lint check
- `npm run build` — production build
- `npm run test` — run unit tests (Vitest)
- `npm run test:e2e` — run e2e tests (Playwright)

## Backend Proxy Commands
- `npm run build:proxy` — compile Lambda handler to `backend-proxy/dist/`
- Package `backend-proxy/dist/index.js` as zip for AWS Lambda deployment

## Environment Setup

### Frontend (.env)
```
VITE_AI_API_URL=https://d379s360969u0c.cloudfront.net/api/fibot-ai-proxy
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_AI_AUTH_HEADER=Authorization
```

### Lambda Environment Variables
```
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AI_API_KEY=<gemini-api-key>
AI_PROVIDER=gemini
AI_AUTH_HEADER=x-goog-api-key
ALLOWED_ORIGIN=https://d379s360969u0c.cloudfront.net
```

## Validation
- Validate UI against baseline viewports: 1366x768, 1440x900, 1920x1080.
- Validate chat send/empty-submit behavior.
- Validate model selector and capability badges in sidebar.
- Validate status indicators (encryption badge, session status).
- Validate AI response flow: send message → loading state → assistant response appended.
- Validate error handling: disconnect network → send message → error shown in chat.
- Validate suggestion chips: click chip → message sent as user.
- Validate voice input: click mic → speak → text appears in input field.
- Validate TTS: receive assistant message → voice playback starts; toggle off → playback stops.
- Validate language toggle: switch ES/EN → all labels update immediately.
- Validate dark mode: toggle theme → interface switches color scheme.
- Validate chart rendering: assistant returns mermaid bar chart block → QuickChart image displayed.
- Validate CSV export: assistant returns HTML table → "Download CSV" button appears and triggers download.

## Execution Log
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS (5 unit tests)
- `npm run test:e2e`: PASS (2 e2e tests)
- `npm run build:proxy`: PASS (CommonJS output)

## Performance Log
- First contentful paint (`FCP_MS`): `0.00` ms (headless Playwright run)
- Message-send interaction latency (`INTERACTION_MS`): `1.30` ms
