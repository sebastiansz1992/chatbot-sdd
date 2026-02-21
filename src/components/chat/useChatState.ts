import { useMemo, useState } from 'react'
import { initialMessages } from '../../data/mockData'
import type { ChatMessage } from '../../types/ui'

export function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draftMessage, setDraftMessage] = useState('')

  const canSend = useMemo(() => draftMessage.trim().length > 0, [draftMessage])

  const sendMessage = () => {
    const content = draftMessage.trim()
    if (!content) return

    const message: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, message])
    setDraftMessage('')
  }

  return { messages, draftMessage, setDraftMessage, canSend, sendMessage }
}
