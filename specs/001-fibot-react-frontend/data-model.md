# Data Model

## Frontend Types (src/types/ui.ts)

- **ModelOption**: id, name, provider, isSelected
- **ChatMessage**: id, role (`'assistant' | 'user'`), content, timestamp
- **SessionStatus**: encryptionLabel, connectionLabel, isConnected
- **UserProfileSummary**: displayName, tierLabel, avatarUrl?

## AI Client Types (src/services/aiChatClient.ts)

- **ChatCompletionRequest**: model?, messages[] (`{ role, content }`)
- **ChatCompletionResponse**: content?, message?, output_text?, choices[] — supports multiple provider response formats
- **ChatErrorResponse**: error?, message? — parsed from non-OK upstream responses

## Backend Proxy Types (backend-proxy/src/index.ts)

- **UpstreamRequest**: model?, messages[] (`{ role, content }`)
- **UpstreamResponse**: content?, message?, output_text?, choices[], candidates[] — unified envelope for OpenAI-compatible and Gemini responses
- **UpstreamErrorPayload**: error `{ message?, status?, code? }` — structured error from AI provider
- **LambdaEvent**: httpMethod?, body (string | null)
- **LambdaResult**: statusCode, headers, body
- **IncomingBody**: model?, messages[]?, contents[]? — dual input format support
- **Provider**: `'openai-compatible' | 'gemini'`
