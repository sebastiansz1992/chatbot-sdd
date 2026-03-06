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
VITE_AI_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/<function>
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
ALLOWED_ORIGIN=http://<bucket>.s3-website-<region>.amazonaws.com
```

## Validation
- Validate UI against baseline viewports: 1366x768, 1440x900, 1920x1080.
- Validate chat send/empty-submit behavior.
- Validate model selector and insight cards.
- Validate status indicators.
- Validate AI response flow: send message → loading state → assistant response appended.
- Validate error handling: disconnect network → send message → error shown in chat.

## Execution Log
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS (5 unit tests)
- `npm run test:e2e`: PASS (2 e2e tests)
- `npm run build:proxy`: PASS (CommonJS output)

## Performance Log
- First contentful paint (`FCP_MS`): `0.00` ms (headless Playwright run)
- Message-send interaction latency (`INTERACTION_MS`): `1.30` ms
