# Implementation Plan: FiBot Frontend Experience

**Branch**: `001-fibot-react-frontend` | **Date**: 2026-02-20 | **Updated**: 2026-04-19 | **Spec**: `specs/001-fibot-react-frontend/spec.md`

## Summary
Build a financial advisor chat interface using React + TypeScript + Tailwind CSS with real-time AI-powered responses via a backend proxy deployed on AWS Lambda + CloudFront. Features include voice input/output (Web Speech API), rich content rendering (Markdown, charts via QuickChart, CSV export), multilingual support (ES/EN), dark mode, and suggestion chips.

## Technical Context
**Language/Version**: TypeScript 5.x, HTML5, CSS (Tailwind CSS 3.x)  
**Primary Dependencies**: React 19.x, Vite 8.x, Tailwind CSS 3.x, PostCSS, Autoprefixer, React Icons, DOMPurify, Marked.js, MSSQL  
**Backend Runtime**: Node.js 20.x (AWS Lambda)  
**AI Provider**: Google Gemini (`generativelanguage.googleapis.com/v1beta`), extensible to OpenAI-compatible APIs  
**Chart Rendering**: QuickChart.io (server-side chart image generation from JSON config)  
**Storage**: localStorage (language + TTS preferences), in-memory state, stateless Lambda  
**Testing**: Vitest + React Testing Library + Playwright  
**Target Platform**: Modern desktop browsers  
**Project Type**: web (frontend + serverless backend proxy)  
**Hosting**: Frontend via AWS CloudFront + S3 (`https://d379s360969u0c.cloudfront.net`), Backend on AWS Lambda behind API Gateway  
**Performance Goals**: FCR < 2.0s, interaction feedback < 100ms, AI response < 30s  
**Constraints**: Match design hierarchy, responsive laptop/desktop, accessibility baseline, API key never exposed in frontend

## Architecture

```text
┌─────────────┐       HTTPS/POST       ┌──────────────────┐      HTTPS/POST      ┌─────────────────┐
│  CloudFront  │ ───────────────────►  │  API Gateway      │ ──────────────────► │  Lambda Proxy    │
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
| `VITE_AI_API_URL` | URL of the Lambda proxy endpoint (CloudFront path) |
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
| `ALLOWED_ORIGIN` | CORS allowed origin (e.g., CloudFront distribution URL) |

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
│   └── App.tsx                    ← Root composition: theme, lang, TTS management
├── components/
│   ├── chat/
│   │   ├── ChatComposer.tsx       ← Input with speech recognition button
│   │   ├── ChatDisclaimer.tsx     ← Risk disclaimer
│   │   ├── ChatTimeline.tsx       ← Message list with AI thinking indicator
│   │   ├── MessageBubble.tsx      ← Rich message renderer (HTML/MD/charts/tables)
│   │   ├── SuggestionChips.tsx    ← Quick-reply chips after welcome message
│   │   ├── useChatState.ts        ← Chat state, send, message history
│   │   ├── useSpeechRecognition.ts← Web Speech API voice input hook
│   │   └── useSpeechSynthesis.ts  ← SpeechSynthesis TTS hook
│   ├── layout/
│   │   ├── ActiveSessionStatus.tsx
│   │   ├── AppShell.tsx           ← Responsive shell with mobile sidebar
│   │   ├── EncryptionStatusBadge.tsx
│   │   ├── Sidebar.tsx            ← Engine, capabilities, branding
│   │   └── TopStatusBar.tsx       ← Theme/lang toggles + status badges
│   └── models/
│       ├── ModelOptionItem.tsx
│       ├── ModelSelector.tsx
│       └── useModelSelection.ts
├── data/
│   ├── content.ts                 ← Static app title constants
│   └── mockData.ts                ← Model options, session status, profile
├── i18n/
│   └── translations.ts            ← ES/EN translation strings (40+ keys)
├── services/
│   └── aiChatClient.ts            ← API client with retry + language param
├── types/
│   └── ui.ts                      ← Shared TypeScript interfaces
├── utils/
│   └── exportData.ts              ← CSV download utilities
└── styles/
    └── globals.css                ← Tailwind utilities + focus styles

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
