import type { ChatMessage } from '../../types/ui'
import DOMPurify from 'dompurify'

type MessageBubbleProps = {
  message: ChatMessage
}

export function MessageBubble({ message }: Readonly<MessageBubbleProps>) {
  const isAssistant = message.role === 'assistant'
  const assistantHtml = isAssistant
    ? DOMPurify.sanitize(message.content, {
        USE_PROFILES: { html: true },
      })
    : ''

  return (
    <article
      className={`w-full max-w-full rounded-xl border px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-3xl ${
        isAssistant
          ? 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          : 'ml-auto border-blue-300 bg-blue-50 text-slate-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-slate-100'
      }`}
      data-testid={`message-${message.role}`}
    >
      {isAssistant ? (
        <div className="prose prose-sm max-w-none break-words dark:prose-invert" dangerouslySetInnerHTML={{ __html: assistantHtml }} />
      ) : (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      )}
    </article>
  )
}
