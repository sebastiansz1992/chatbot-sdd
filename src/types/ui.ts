export type ModelOption = {
  id: string
  name: string
  provider: string
  isSelected: boolean
}

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: string
}

export type SessionStatus = {
  encryptionLabel: string
  connectionLabel: string
  isConnected: boolean
}

export type UserProfileSummary = {
  displayName: string
  tierLabel: string
  avatarUrl?: string
}
