import { useMemo, useState } from 'react'
import { initialMessages } from '../../data/mockData'
import type { ChatMessage } from '../../types/ui'
import { requestAssistantReply } from '../../services/aiChatClient'

const FALLBACK_ERROR_MESSAGE =
  'No pude responder en este momento. Verifica la conexión con el proveedor de IA e inténtalo de nuevo.'

function buildMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  }
}

export function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draftMessage, setDraftMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const canSend = useMemo(() => draftMessage.trim().length > 0 && !isSending, [draftMessage, isSending])

  const sendMessage = async () => {
    const content = draftMessage.trim()
    if (!content || isSending) return

    const userMessage = buildMessage('user', content)
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setDraftMessage('')

    setIsSending(true)

    try {
      const assistantText = await requestAssistantReply(nextMessages)
      setMessages((prev) => [...prev, buildMessage('assistant', assistantText)])
    } catch (error) {
      const message = error instanceof Error && error.message.trim() ? error.message : FALLBACK_ERROR_MESSAGE
      setMessages((prev) => [...prev, buildMessage('assistant', message)])
    } finally {
      setIsSending(false)
    }
  }

  return { messages, draftMessage, setDraftMessage, canSend, sendMessage, isSending }
}
