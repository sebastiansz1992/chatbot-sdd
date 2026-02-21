import type { ChatMessage } from '../../types/ui'
import { MessageBubble } from './MessageBubble'

type ChatTimelineProps = {
  messages: ChatMessage[]
}

export function ChatTimeline({ messages }: Readonly<ChatTimelineProps>) {
  return (
    <section className="chat-scroll flex-1 space-y-4 overflow-y-auto px-8 py-6" aria-label="Conversación">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </section>
  )
}
