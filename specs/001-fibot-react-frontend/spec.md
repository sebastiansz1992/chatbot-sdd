# Feature Specification: FiBot Frontend Experience

**Feature Branch**: `001-fibot-react-frontend`  
**Created**: 2026-02-20  
**Updated**: 2026-04-19  
**Status**: In Progress

## User Scenarios & Testing

### User Story 1 - Chat with Financial Assistant (Priority: P1)
As an advisor, I can see assistant greeting, type a message, send it, and view it in timeline.

### User Story 2 - View Model Selector and Sidebar Capabilities (Priority: P2)
As an advisor, I can view the active engine, capability badges, and quick-reply suggestion chips.

### User Story 3 - Understand Session and Security Context (Priority: P3)
As an advisor, I can view encryption and active-session status.

### User Story 4 - Receive AI-Powered Responses (Priority: P1)
As an advisor, I can send a message and receive a real-time response from an AI agent via a backend proxy deployed on AWS Lambda/CloudFront, so that the chat provides meaningful financial guidance.

### User Story 5 - Voice Input and Output (Priority: P2)
As an advisor, I can click a microphone button to dictate my message using speech recognition, and the assistant's replies are automatically read aloud via text-to-speech.

### User Story 6 - Rich Content Rendering (Priority: P2)
As an advisor, assistant messages that contain Markdown, HTML tables, or chart code blocks are rendered visually — including interactive bar charts via QuickChart and downloadable CSV exports from tables.

### User Story 7 - Multilingual Interface (Priority: P2)
As an advisor, I can toggle the interface between Spanish and English so that labels, welcome messages, suggestions, and error text all update to the selected language.

### User Story 8 - Dark Mode (Priority: P3)
As an advisor, I can toggle between light and dark themes so that the interface is comfortable in different lighting conditions.

### Edge Cases
- Baseline viewports: 1366x768, 1440x900, 1920x1080.
- Long chat input wraps without overflow.
- Empty timeline still shows assistant greeting followed by suggestion chips.
- AI provider returns 429 (rate limit / quota exhausted): user sees descriptive error message in chat.
- AI provider unreachable or times out: user sees fallback error message.
- Frontend configured without `VITE_AI_API_URL`: descriptive configuration error shown.
- Backend receives both `messages` (OpenAI-compatible) and `contents` (Gemini-native) input formats.
- Local error messages from assistant are filtered from subsequent AI request payloads.
- Speech recognition permission denied: inline error shown below composer, mic button disabled.
- Browser does not support Web Speech API: mic button hidden or disabled gracefully.
- TTS preference persisted across page reloads via localStorage.
- Language preference persisted across page reloads via localStorage.
- Table with no rows renders without export button.
- Mermaid block with unrecognized format falls back to plain code block.

## Requirements

### Functional Requirements
- **FR-001**: Single-page layout with sidebar, header/status bar, and chat workspace.
- **FR-002**: Sidebar shows active AI engine (FinGPT Expert) with online status indicator.
- **FR-003**: Sidebar shows capability badges: Analysis, Charts, Export, Data Fabric.
- **FR-004**: Initial assistant welcome message appears on load, followed by suggestion chips.
- **FR-005**: User can type and submit chat message.
- **FR-006**: Empty message submission is prevented.
- **FR-007**: Submitted user message is appended chronologically.
- **FR-008**: Financial-advice disclaimer is visible below composer.
- **FR-009**: Encryption and connection status indicators are visible in the top bar.
- **FR-010**: "Powered by Thinkus AI" attribution shown in sidebar footer.
- **FR-011**: Layout remains readable at desktop/laptop sizes.
- **FR-012**: Submitted message triggers async AI request through backend proxy; assistant response is appended to timeline.
- **FR-013**: Chat composer shows loading state (disabled input, visual indicator) while AI request is in flight.
- **FR-014**: Backend Lambda proxy forwards chat messages to configured AI provider and returns assistant text.
- **FR-015**: Backend proxy accepts dual input formats (`messages` array or `contents` array) and normalizes before forwarding.
- **FR-016**: AI provider errors (4xx/5xx) are parsed and displayed as descriptive assistant messages in the chat timeline.
- **FR-017**: CORS headers are included in all Lambda responses.
- **FR-018**: Microphone button in composer activates Web Speech API for voice input; transcript is appended to current input text.
- **FR-019**: Assistant messages are automatically spoken via browser TTS after each response; user can toggle TTS on/off.
- **FR-020**: TTS and language preferences are persisted to localStorage.
- **FR-021**: Assistant messages containing Markdown are parsed and rendered as HTML (headings, bold, lists, code blocks, tables).
- **FR-022**: HTML in assistant messages is sanitized with DOMPurify before rendering.
- **FR-023**: Mermaid bar chart code blocks in assistant messages are converted to QuickChart.io `<img>` tags.
- **FR-024**: HTML tables in assistant messages display a "Download CSV" button that triggers a local file download.
- **FR-025**: Language toggle in top bar switches all UI text between Spanish (ES) and English (EN).
- **FR-026**: Theme toggle in top bar switches between light and dark mode.
- **FR-027**: Suggestion chips appear after the welcome message; clicking a chip sends it as a user message.
- **FR-028**: API client retries failed requests (403, 429, 502, 503, 504) up to 2 times with exponential backoff.

### Non-Functional Requirements
- **NFR-001**: Visual hierarchy matches design regions and no overlap at baseline viewports.
- **NFR-002**: Performance targets: FCR < 2.0s and message-send feedback < 100ms.
- **NFR-003**: AI API key must never be exposed in frontend code; all provider authentication is handled by the backend proxy.
- **NFR-004**: Lambda timeout configured at 30s to accommodate upstream AI provider latency.
- **NFR-005**: Backend proxy input is validated and sanitized (role whitelisting, non-empty content enforcement).
- **NFR-006**: All rendered HTML from assistant messages must be sanitized through DOMPurify before insertion into the DOM.
- **NFR-007**: Speech recognition errors (permission denied, browser not supported) must not crash the UI.

## Success Criteria
- **SC-001**: Users find chat input/send in under 10s.
- **SC-002**: 95% complete send flow on first attempt.
- **SC-003**: 90% identify active engine and capability badges in under 20s.
- **SC-004**: 90% report session/security indicators are clear.
- **SC-005**: No blocking overlap issues on baseline viewports.
- **SC-006**: User sends a message and receives an AI-generated response within 30s.
- **SC-007**: Error messages from AI provider are displayed in chat without crashing the UI.
- **SC-008**: Microphone button captures voice and fills input without page reload or error.
- **SC-009**: Assistant response containing a bar chart code block renders as a visible chart image.
- **SC-010**: Language toggle immediately updates all visible labels without page reload.
