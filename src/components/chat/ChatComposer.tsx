import { FiPaperclip, FiSend } from 'react-icons/fi'

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  canSend: boolean
  placeholder: string
  consultingText: string
  inputAriaLabel: string
  sendAriaLabel: string
  isSending: boolean
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  canSend,
  placeholder,
  consultingText,
  inputAriaLabel,
  sendAriaLabel,
  isSending,
}: Readonly<ChatComposerProps>) {
  return (
    <section className="mx-auto mb-2 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <FiPaperclip className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isSending}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !isSending) {
              onSend()
            }
          }}
          className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
          placeholder={isSending ? consultingText : placeholder}
          aria-label={inputAriaLabel}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={onSend}
          className="rounded-xl bg-blue-500 p-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          aria-label={sendAriaLabel}
        >
          <FiSend />
        </button>
      </div>
    </section>
  )
}
