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
- **Language forwarding**: `language` field from request body forwarded to AI provider prompt context for response language selection.

## CORS
- Lambda adds `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods` headers to all responses.
- API Gateway HTTP API must independently handle `OPTIONS` preflight — Lambda CORS headers only apply to actual requests routed to the function.
- **Known issue**: API Gateway managed CORS configuration must be explicitly set via console or CLI (`aws apigatewayv2 update-api --cors-configuration`) and redeployed to take effect.

## Gemini Free Tier
- Free tier may return `RESOURCE_EXHAUSTED` with `limit: 0` if Google Cloud project billing is not enabled.
- Enabling billing on the Google Cloud project resolves the quota issue.

## Rich Content Rendering
- **DOMPurify** selected for HTML sanitization to prevent XSS before inserting assistant HTML into the DOM. All assistant content passes through `DOMPurify.sanitize()`.
- **Marked.js** selected for Markdown parsing (GFM mode): provides heading, bold/italic, table, code block, and inline code support with minimal configuration.
- **QuickChart.io** selected for server-side chart image generation: accepts a JSON chart config as a URL parameter and returns a PNG image. No client-side canvas required; images are stable and embeddable.
- **Mermaid-to-QuickChart conversion**: AI responses containing `mermaid` fenced code blocks with bar/pie chart data are parsed client-side and converted to QuickChart `<img>` URLs. This avoids the Mermaid.js runtime (large bundle, CSP issues) while still rendering visual charts.

## Voice Input / Output
- **Web Speech API** selected for both speech recognition and TTS: browser-native, no external SDK required.
- **SpeechRecognition** (`webkitSpeechRecognition` fallback for Chrome/Edge): `interimResults: true` enables live transcript preview in the input placeholder.
- **SpeechSynthesis**: voices filtered by language locale (`es-CO`/`en-US`). HTML tags stripped from assistant text before synthesis to avoid reading raw markup.
- **Persistence**: TTS enabled/disabled state stored in `localStorage` under `FIBOT_TTS_ENABLED`. Language preference stored under `FIBOT_LANG_STORAGE_KEY`.
- **Browser support**: Safari partial support for SpeechRecognition. Feature detection guards prevent crashes; mic button hidden or shows error when unsupported.

## Multilingual Support
- **ES (Spanish)** as primary language, **EN (English)** as secondary.
- All visible strings (labels, placeholders, disclaimers, errors, suggestions) routed through `translations.ts`.
- Language state managed in `App.tsx` and threaded down via props to avoid a global context dependency.
- Language sent to backend proxy so the AI model generates responses in the user's selected language.

## Retry Logic
- `aiChatClient` implements 2 retries on transient failure status codes: 403, 429, 502, 503, 504.
- Backoff: 1500ms exponential between attempts (1.5s, 3s).
- Rationale: Gemini and Lambda cold-start scenarios can produce brief 503s; retry avoids surfacing these as permanent errors.

## CSV Export
- `exportData.ts` uses `Blob` + object URL for download — no server round-trip.
- UTF-8 BOM prepended for correct Excel encoding of Spanish characters (accents, ñ).
- CSV escaping handles commas, double quotes, and embedded newlines per RFC 4180.

## Deployment
- Frontend hosted on AWS CloudFront backed by S3 for global edge caching and HTTPS.
- CloudFront distribution: `https://d379s360969u0c.cloudfront.net`
- API path `/api/fibot-ai-proxy` routes through CloudFront to API Gateway, avoiding mixed-content and CORS issues by keeping all traffic under the same origin.
