# Implementation Plan: FiBot Frontend Experience

**Branch**: `001-fibot-react-frontend` | **Date**: 2026-02-20 | **Updated**: 2026-03-06 | **Spec**: `specs/001-fibot-react-frontend/spec.md`

## Summary
Build a financial advisor chat interface using React + TypeScript + Tailwind CSS with real-time AI-powered responses via a backend proxy deployed on AWS Lambda + API Gateway. The AI provider is Google Gemini, with support for OpenAI-compatible providers.

## Technical Context
**Language/Version**: TypeScript 5.x, HTML5, CSS (Tailwind CSS 3.x)  
**Primary Dependencies**: React 19.x, Vite 8.x, Tailwind CSS 3.x, PostCSS, Autoprefixer, React Icons  
**Backend Runtime**: Node.js 20.x (AWS Lambda)  
**AI Provider**: Google Gemini (`generativelanguage.googleapis.com/v1beta`), extensible to OpenAI-compatible APIs  
**Storage**: N/A (in-memory state, stateless Lambda)  
**Testing**: Vitest + React Testing Library + Playwright  
**Target Platform**: Modern desktop browsers  
**Project Type**: web (frontend + serverless backend proxy)  
**Hosting**: Frontend on AWS S3 (static site), Backend on AWS Lambda behind API Gateway (HTTP API)  
**Performance Goals**: FCR < 2.0s, interaction feedback < 100ms, AI response < 30s  
**Constraints**: Match design hierarchy, responsive laptop/desktop, accessibility baseline, API key never exposed in frontend

## Architecture

```text
┌─────────────┐       HTTPS/POST       ┌──────────────────┐      HTTPS/POST      ┌─────────────────┐
│  S3 Frontend │ ───────────────────►  │  API Gateway      │ ──────────────────► │  Lambda Proxy    │
│  (React SPA) │ ◄─────────────────── │  (HTTP API)       │ ◄────────────────── │  (Node.js 20.x) │
└─────────────┘       JSON response    └──────────────────┘      JSON response   └────────┬────────┘
                                                                                          │
                                                                                   HTTPS/POST
                                                                                          │
                                                                                          ▼
                                                                                 ┌─────────────────┐
                                                                                 │  Google Gemini   │
                                                                                 │  API             │
                                                                                 └─────────────────┘
```

## Environment Variables

### Frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_AI_API_URL` | URL of the Lambda proxy endpoint |
| `VITE_AI_API_KEY` | Optional; leave empty if proxy handles auth |
| `VITE_AI_MODEL` | Optional model override |
| `VITE_AI_AUTH_HEADER` | Auth header name (default: `Authorization`) |

### Backend Lambda
| Variable | Description |
|---|---|
| `AI_API_URL` | Upstream AI provider URL (e.g., Gemini endpoint) |
| `AI_API_KEY` | Provider API key (e.g., Gemini API key) |
| `AI_PROVIDER` | `gemini` or `openai-compatible` |
| `AI_AUTH_HEADER` | Auth header for provider (default: `Authorization`, Gemini uses `x-goog-api-key`) |
| `AI_MODEL` | Default model name |
| `ALLOWED_ORIGIN` | CORS allowed origin (e.g., S3 bucket URL) |

## Constitution Check
- Constitution source: `.specify/memory/constitution.md`.
- Gate decision: PASS against MUST rules.

## Project Structure
```text
specs/001-fibot-react-frontend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
└── tasks.md

src/
├── app/
├── components/
│   ├── chat/
│   ├── layout/
│   ├── models/
│   └── insights/
├── data/
├── services/          ← AI HTTP client
├── types/
├── styles/
└── main.tsx

backend-proxy/         ← AWS Lambda proxy
├── src/
│   └── index.ts       ← Lambda handler (CommonJS output)
├── tsconfig.json
└── README.md

tests/
├── unit/
└── e2e/
```

## Complexity Tracking
No constitution violations requiring justification.
