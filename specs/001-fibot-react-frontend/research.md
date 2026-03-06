# Research

## Frontend Stack
- React + TypeScript + Vite selected for frontend-only MVP.
- Tailwind CSS selected for rapid, consistent design implementation.
- Vitest + RTL + Playwright selected for unit and smoke e2e validation.

## AI Integration
- **Provider selection**: Evaluated OpenAI, GitHub Models, Google Gemini, Anthropic. Selected Google Gemini for free-tier availability and fast inference.
- **Architecture decision**: API key must not be exposed in frontend code. A backend proxy pattern is required to keep credentials server-side.
- **AWS Lambda + API Gateway** selected as serverless proxy: stateless, low cost, compatible with Node.js runtime.
- **S3 cannot serve as proxy**: S3 only serves static content. A compute layer (Lambda) is required for proxying API calls.

## Backend Proxy Design
- **CommonJS output**: Lambda Node.js 20.x runtime requires CommonJS (`module.exports`) rather than ESM (`export`). TypeScript `tsconfig.json` configured with `"module": "CommonJS"`.
- **Dual input format**: Proxy accepts both OpenAI-compatible `messages` array and Gemini-native `contents` array. `resolveIncomingMessages()` normalizes both to a common internal format.
- **Gemini message mapping**: System messages separated into `systemInstruction` field. Conversation messages mapped to `{role: "user"|"model", parts: [{text}]}` format.
- **Auth header**: Gemini uses `x-goog-api-key` (plain key), not `Bearer` token pattern.
- **Error parsing**: Upstream errors parsed for `error.message` and `error.status`. 429 errors get an additional billing hint.

## CORS
- Lambda adds `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods` headers to all responses.
- API Gateway HTTP API must independently handle `OPTIONS` preflight — Lambda CORS headers only apply to actual requests routed to the function.
- **Known issue**: API Gateway managed CORS configuration must be explicitly set via console or CLI (`aws apigatewayv2 update-api --cors-configuration`) and redeployed to take effect.

## Gemini Free Tier
- Free tier may return `RESOURCE_EXHAUSTED` with `limit: 0` if Google Cloud project billing is not enabled.
- Enabling billing on the Google Cloud project resolves the quota issue.
