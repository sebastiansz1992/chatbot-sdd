# Tasks: FiBot Frontend Experience

## Phase 1: Setup
- [x] T001 Initialize React + TypeScript Vite app configuration in package.json
- [x] T002 Configure TypeScript compiler settings for app build in tsconfig.json
- [x] T003 Configure Vite app entry/build defaults in vite.config.ts
- [x] T004 Configure Tailwind content scanning and theme base in tailwind.config.js
- [x] T005 Configure PostCSS pipeline for Tailwind in postcss.config.js
- [x] T006 Apply Tailwind directives and base styles in src/index.css
- [x] T007 [P] Configure lint scripts and standards in .eslintrc.cjs
- [x] T008 [P] Configure formatting rules in .prettierrc

## Phase 2: Foundational
- [x] T009 Define shared UI entities and state types in src/types/ui.ts
- [x] T010 Create typed mock datasets for models/insights/messages/status/profile in src/data/mockData.ts
- [x] T011 Create shared static labels and disclaimers in src/data/content.ts
- [x] T012 Build application shell layout component (sidebar/header/main regions) in src/components/layout/AppShell.tsx
- [x] T013 Build root app composition scaffold in src/app/App.tsx
- [x] T014 Wire app bootstrap and global style import in src/main.tsx
- [x] T015 Create global utility style layer for spacing/overflow/focus baseline in src/styles/globals.css

## Phase 3: US1
- [x] T042 [P] [US1] Add unit test for empty-submit prevention in tests/unit/chatComposer.emptySubmit.test.tsx
- [x] T043 [P] [US1] Add unit test for message append and input clear on send in tests/unit/chatFlow.sendMessage.test.tsx
- [x] T016 [P] [US1] Create message bubble presentation component in src/components/chat/MessageBubble.tsx
- [x] T017 [P] [US1] Create chat timeline renderer component in src/components/chat/ChatTimeline.tsx
- [x] T018 [P] [US1] Create chat composer/input component in src/components/chat/ChatComposer.tsx
- [x] T019 [US1] Implement chat state and submit handler logic in src/components/chat/useChatState.ts
- [x] T020 [US1] Integrate chat timeline + composer into main workspace in src/app/App.tsx
- [x] T021 [US1] Render assistant welcome message from initial state in src/components/chat/useChatState.ts
- [x] T022 [US1] Enforce empty-message submit prevention and input reset behavior in src/components/chat/ChatComposer.tsx
- [x] T023 [US1] Display advisory disclaimer below chat composer in src/components/chat/ChatDisclaimer.tsx

## Phase 4: US2
- [x] T044 [P] [US2] Add unit tests for single selected model and minimum four insight cards in tests/unit/sidebar.modelsInsights.test.tsx
- [x] T024 [P] [US2] Create model option item component with selected styling in src/components/models/ModelOptionItem.tsx
- [x] T025 [P] [US2] Create model selector list component in src/components/models/ModelSelector.tsx
- [x] T026 [P] [US2] Create market insight card component in src/components/insights/InsightCard.tsx
- [x] T027 [P] [US2] Create quick insights list section component in src/components/insights/QuickInsights.tsx
- [x] T028 [US2] Implement selected-model state control hook in src/components/models/useModelSelection.ts
- [x] T029 [US2] Compose sidebar sections (models + insights + profile) in src/components/layout/Sidebar.tsx
- [x] T030 [US2] Add graceful placeholder rendering for missing insight values in src/components/insights/QuickInsights.tsx
- [x] T031 [US2] Mount sidebar into shell layout in src/components/layout/AppShell.tsx

## Phase 5: US3
- [x] T045 [P] [US3] Add unit test for visible encryption and connection status indicators in tests/unit/topStatusBar.visibility.test.tsx
- [x] T032 [P] [US3] Create encryption status badge component in src/components/layout/EncryptionStatusBadge.tsx
- [x] T033 [P] [US3] Create active session status component in src/components/layout/ActiveSessionStatus.tsx
- [x] T034 [US3] Compose top header status bar with both indicators in src/components/layout/TopStatusBar.tsx
- [x] T035 [US3] Bind header components to typed session status data in src/app/App.tsx
- [x] T036 [US3] Add semantic labels/ARIA for status readability in src/components/layout/TopStatusBar.tsx

## Phase 6: Polish
- [x] T037 [P] Refine responsive layout behavior for laptop/desktop widths in src/components/layout/AppShell.tsx
- [x] T038 [P] Fix text wrapping and overflow safeguards for long chat messages in src/components/chat/MessageBubble.tsx
- [x] T039 [P] Add consistent keyboard focus styles for interactive controls in src/styles/globals.css
- [x] T040 Update implementation notes and run instructions in README.md
- [x] T041 Validate delivered behavior against quickstart checklist in specs/001-fibot-react-frontend/quickstart.md
- [x] T046 [P] Add smoke e2e test for open app -> send message -> timeline append in tests/e2e/chat.smoke.spec.ts
- [x] T047 Run lint/build/test quality gates and record outcomes in specs/001-fibot-react-frontend/quickstart.md
- [x] T048 Measure first contentful render against <2.0s target and log result in specs/001-fibot-react-frontend/quickstart.md
- [x] T049 Measure message-send interaction feedback against <100ms target and log result in specs/001-fibot-react-frontend/quickstart.md

## Phase 7: US4 — AI Agent Integration
- [x] T050 [US4] Create AI HTTP client service in src/services/aiChatClient.ts
- [x] T051 [US4] Add environment variable template in .env.example with VITE_AI_* variables
- [x] T052 [US4] Refactor useChatState to async send with AI request/response cycle in src/components/chat/useChatState.ts
- [x] T053 [US4] Add isSending loading state and disabled UI in ChatComposer and App
- [x] T054 [US4] Implement error detail parsing and display as assistant message in chat timeline
- [x] T055 [US4] Filter local error assistant messages from AI request payload in aiChatClient.ts
- [x] T056 [US4] Update unit tests for async AI flow in tests/unit/chatFlow.sendMessage.test.tsx

## Phase 8: Backend Proxy (Lambda)
- [x] T057 Create Lambda handler with provider routing in backend-proxy/src/index.ts
- [x] T058 Configure TypeScript build for CommonJS output in backend-proxy/tsconfig.json
- [x] T059 Add build:proxy npm script in package.json
- [x] T060 Implement input validation and sanitization (role whitelist, non-empty content) in handler
- [x] T061 Add Gemini provider support: message format mapping, systemInstruction, x-goog-api-key auth
- [x] T062 Add dual input format support (messages + contents) with resolveIncomingMessages
- [x] T063 Implement upstream error detail parsing with 429 rate-limit hint
- [x] T064 Add CORS headers to all Lambda responses (Access-Control-Allow-Origin, Methods, Headers)
- [x] T065 Create backend proxy deploy documentation in backend-proxy/README.md

## Phase 9: AWS Deployment
- [x] T066 Deploy frontend build to S3 static website hosting
- [x] T067 Deploy Lambda function with Node.js 20.x runtime
- [x] T068 Configure API Gateway HTTP API with POST route to Lambda
- [ ] T069 Configure API Gateway CORS preflight to return proper Access-Control-Allow-Origin headers
- [ ] T070 Verify end-to-end flow: S3 frontend → API Gateway → Lambda → Gemini → response in chat
