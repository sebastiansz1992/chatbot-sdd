import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../types/ui'
import { requestAssistantReply } from '../../services/aiChatClient'
import type { Language } from '../../i18n/translations'

function buildMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  }
}

export function useChatState(welcomeMessage: string, language: Language, errorFallback: string) {
  const welcomeIdRef = useRef<string>('')

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const msg = buildMessage('assistant', welcomeMessage)
    welcomeIdRef.current = msg.id
    return [msg]
  })

  const [draftMessage, setDraftMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0].id !== welcomeIdRef.current) return prev
      return [{ ...prev[0], content: welcomeMessage }, ...prev.slice(1)]
    })
  }, [welcomeMessage])

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
      const assistantText = await requestAssistantReply(nextMessages, language)
      setMessages((prev) => [...prev, buildMessage('assistant', assistantText)])
    } catch (error) {
      const message = error instanceof Error && error.message.trim() ? error.message : errorFallback
      setMessages((prev) => [...prev, buildMessage('assistant', message)])
    } finally {
      setIsSending(false)
    }
  }

  return { messages, draftMessage, setDraftMessage, canSend, sendMessage, isSending }
}
