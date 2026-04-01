import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../types/ui'
import { MessageBubble } from './MessageBubble'
import { FiCpu } from 'react-icons/fi'

type ChatTimelineProps = {
  messages: ChatMessage[]
  isAssistantThinking?: boolean
  thinkingLabel: string
  thinkingAriaLabel: string
  conversationAriaLabel: string
  exportTableLabel: string
}

export function ChatTimeline({
  messages,
  isAssistantThinking = false,
  thinkingLabel,
  thinkingAriaLabel,
  conversationAriaLabel,
  exportTableLabel,
}: Readonly<ChatTimelineProps>) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAssistantThinking])

  return (
    <section className="chat-scroll flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6" aria-label={conversationAriaLabel}>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          exportTableLabel={exportTableLabel}
        />
      ))}

      {isAssistantThinking ? (
        <div
          className="flex items-start gap-3 w-full"
          aria-live="polite"
          aria-label={thinkingAriaLabel}
          data-testid="assistant-thinking"
        >
          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FiCpu size={15} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
          </div>
          <article className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:max-w-3xl">
            <div className="inline-flex items-center gap-2">
              <span>{thinkingLabel}</span>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s] dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s] dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" />
              </span>
            </div>
          </article>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </section>
  )
}
