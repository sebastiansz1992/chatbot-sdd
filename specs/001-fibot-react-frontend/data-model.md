# Data Model

## Frontend Types (src/types/ui.ts)

- **ModelOption**: id, name, provider, isSelected
- **ChatMessage**: id, role (`'assistant' | 'user'`), content, timestamp
- **SessionStatus**: encryptionLabel, connectionLabel, isConnected
- **UserProfileSummary**: displayName, tierLabel, avatarUrl?

## AI Client Types (src/services/aiChatClient.ts)

- **ChatCompletionRequest**: model?, messages[] (`{ role, content }`), language?
- **ChatCompletionResponse**: content?, message?, output_text?, choices[] — supports multiple provider response formats
- **ChatErrorResponse**: error?, message? — parsed from non-OK upstream responses

## Internationalization (src/i18n/translations.ts)

- **Translations**: Record of 40+ UI string keys
  - Keys include: inputPlaceholder, sendButton, sidebarTitle, welcomeMessage, suggestionChips[], capabilities[], ariaLabels, errorMessages, tts/mic control labels
- **Language**: `'es' | 'en'`
- **TRANSLATIONS**: `Record<Language, Translations>` — static lookup object

## Speech Hooks

- **useSpeechRecognition** returns: `{ transcript, interimTranscript, isListening, startListening, stopListening, error, isSupported }`
- **useSpeechSynthesis** returns: `{ speak, stop, isSpeaking, isEnabled, toggleEnabled }`
  - `TTS_STORAGE_KEY`: localStorage key for TTS enabled preference

## Export Utilities (src/utils/exportData.ts)

- **downloadCsv(filename: string, rows: string[][]): void** — triggers browser file download with UTF-8 BOM
- **tableElementToRows(table: HTMLTableElement): string[][]** — extracts table DOM into 2D array for CSV

## Backend Proxy Types (backend-proxy/src/index.ts)

- **UpstreamRequest**: model?, messages[] (`{ role, content }`)
- **UpstreamResponse**: content?, message?, output_text?, choices[], candidates[] — unified envelope for OpenAI-compatible and Gemini responses
- **UpstreamErrorPayload**: error `{ message?, status?, code? }` — structured error from AI provider
- **LambdaEvent**: httpMethod?, body (string | null)
- **LambdaResult**: statusCode, headers, body
- **IncomingBody**: model?, messages[]?, contents[]?, language? — dual input format support
- **Provider**: `'openai-compatible' | 'gemini'`
