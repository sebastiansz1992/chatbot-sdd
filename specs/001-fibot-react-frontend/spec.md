# Feature Specification: FiBot Frontend Experience

**Feature Branch**: `001-fibot-react-frontend`  
**Created**: 2026-02-20  
**Updated**: 2026-03-06  
**Status**: In Progress

## User Scenarios & Testing

### User Story 1 - Chat with Financial Assistant (Priority: P1)
As an advisor, I can see assistant greeting, type a message, send it, and view it in timeline.

### User Story 2 - View Market Snapshot and Model Selector (Priority: P2)
As an advisor, I can view model options and quick insight cards.

### User Story 3 - Understand Session and Security Context (Priority: P3)
As an advisor, I can view encryption and active-session status.

### User Story 4 - Receive AI-Powered Responses (Priority: P1)
As an advisor, I can send a message and receive a real-time response from an AI agent (Google Gemini) via a backend proxy deployed on AWS Lambda, so that the chat provides meaningful financial guidance.

### Edge Cases
- Baseline viewports: 1366x768, 1440x900, 1920x1080.
- Missing insight data renders placeholders.
- Long chat input wraps without overflow.
- Empty timeline still shows assistant greeting.
- AI provider returns 429 (rate limit / quota exhausted): user sees descriptive error message in chat.
- AI provider unreachable or times out: user sees fallback error message.
- Frontend configured without `VITE_AI_API_URL`: descriptive configuration error shown.
- Backend receives both `messages` (OpenAI-compatible) and `contents` (Gemini-native) input formats.
- Local error messages from assistant are filtered from subsequent AI request payloads.

## Requirements

### Functional Requirements
- **FR-001**: Single-page layout with sidebar, header/status, and chat workspace.
- **FR-002**: Sidebar shows model options with exactly one default selected.
- **FR-003**: Sidebar shows at least four market insight cards.
- **FR-004**: Initial assistant welcome message appears on load.
- **FR-005**: User can type and submit chat message.
- **FR-006**: Empty message submission is prevented.
- **FR-007**: Submitted user message is appended chronologically.
- **FR-008**: Financial-advice disclaimer is visible.
- **FR-009**: Encryption and connection status indicators are visible.
- **FR-010**: User profile summary is shown in sidebar footer.
- **FR-011**: Layout remains readable at desktop/laptop sizes.
- **FR-012**: Submitted message triggers async AI request through backend proxy; assistant response is appended to timeline.
- **FR-013**: Chat composer shows loading state (disabled input, visual indicator) while AI request is in flight.
- **FR-014**: Backend Lambda proxy forwards chat messages to configured AI provider (Gemini or OpenAI-compatible) and returns assistant text.
- **FR-015**: Backend proxy accepts dual input formats (`messages` array or `contents` array) and normalizes before forwarding.
- **FR-016**: AI provider errors (4xx/5xx) are parsed and displayed as descriptive assistant messages in the chat timeline.
- **FR-017**: CORS headers are included in all Lambda responses to allow cross-origin requests from the S3-hosted frontend.

### Non-Functional Requirements
- **NFR-001**: Visual hierarchy matches design regions and no overlap at baseline viewports.
- **NFR-002**: Performance targets: FCR < 2.0s and message-send feedback < 100ms using Windows 11, 4-core CPU, 16GB RAM, Chrome stable, no throttling; measure with Lighthouse and browser Performance panel.
- **NFR-003**: AI API key must never be exposed in frontend code; all provider authentication is handled by the backend proxy via environment variables.
- **NFR-004**: Lambda timeout configured at 30s to accommodate upstream AI provider latency.
- **NFR-005**: Backend proxy input is validated and sanitized (role whitelisting, non-empty content enforcement) to prevent injection.

## Success Criteria
- **SC-001**: Users find chat input/send in under 10s.
- **SC-002**: 95% complete send flow on first attempt.
- **SC-003**: 90% identify selected model + two insight values in under 20s.
- **SC-004**: 90% report session/security indicators are clear.
- **SC-005**: No blocking overlap issues on baseline viewports.
- **SC-006**: User sends a message and receives an AI-generated response within 30s.
- **SC-007**: Error messages from AI provider are displayed in chat without crashing the UI.
