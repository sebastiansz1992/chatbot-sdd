import type {
  ChatMessage,
  ModelOption,
  SessionStatus,
  UserProfileSummary,
} from '../types/ui'

export const modelOptions: ModelOption[] = [
  { id: 'fin-gpt-expert', name: 'FinGPT Expert', provider: 'FiBot', isSelected: true },
]

export const initialMessages: ChatMessage[] = [
  {
    id: 'm-1',
    role: 'assistant',
    content:
      'Bienvenido a FiBot. Soy tu asistente seguro de asesoría financiera. ¿Cómo puedo ayudarte hoy a analizar los mercados o revisar tu portafolio?',
    timestamp: new Date().toISOString(),
  },
]

export const sessionStatus: SessionStatus = {
  encryptionLabel: 'Cifrado de extremo a extremo',
  connectionLabel: 'Conectado a OpenAI',
  isConnected: true,
}

export const profile: UserProfileSummary = {
  displayName: 'Mesa de Asesoría',
  tierLabel: 'Plan Pro',
}
