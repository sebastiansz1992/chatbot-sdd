# Feature Specification: FiBot Frontend Experience

**Feature Branch**: `001-fibot-react-frontend`  
**Created**: 2026-02-20  
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Chat with Financial Assistant (Priority: P1)
As an advisor, I can see assistant greeting, type a message, send it, and view it in timeline.

### User Story 2 - View Market Snapshot and Model Selector (Priority: P2)
As an advisor, I can view model options and quick insight cards.

### User Story 3 - Understand Session and Security Context (Priority: P3)
As an advisor, I can view encryption and active-session status.

### Edge Cases
- Baseline viewports: 1366x768, 1440x900, 1920x1080.
- Missing insight data renders placeholders.
- Long chat input wraps without overflow.
- Empty timeline still shows assistant greeting.

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

### Non-Functional Requirements
- **NFR-001**: Visual hierarchy matches design regions and no overlap at baseline viewports.
- **NFR-002**: Performance targets: FCR < 2.0s and message-send feedback < 100ms using Windows 11, 4-core CPU, 16GB RAM, Chrome stable, no throttling; measure with Lighthouse and browser Performance panel.

## Success Criteria
- **SC-001**: Users find chat input/send in under 10s.
- **SC-002**: 95% complete send flow on first attempt.
- **SC-003**: 90% identify selected model + two insight values in under 20s.
- **SC-004**: 90% report session/security indicators are clear.
- **SC-005**: No blocking overlap issues on baseline viewports.
