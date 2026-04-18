import { useEffect } from 'react'
import { FiMic, FiMicOff, FiPaperclip, FiSend } from 'react-icons/fi'
import type { Language } from '../../i18n/translations'
import { useSpeechRecognition } from './useSpeechRecognition'

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
  language: Language
  micStartAriaLabel: string
  micStopAriaLabel: string
  micListeningHint: string
  micPermissionDenied: string
  micErrorGeneric: string
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
  language,
  micStartAriaLabel,
  micStopAriaLabel,
  micListeningHint,
  micPermissionDenied,
  micErrorGeneric,
}: Readonly<ChatComposerProps>) {
  const { isSupported, isListening, interimTranscript, error, toggle, stop } = useSpeechRecognition({
    language,
    onFinalTranscript: (text) => {
      onChange(value ? `${value.trim()} ${text}` : text)
    },
  })

  useEffect(() => {
    if (isSending && isListening) {
      stop()
    }
  }, [isSending, isListening, stop])

  let displayPlaceholder = placeholder
  if (isSending) {
    displayPlaceholder = consultingText
  } else if (isListening) {
    displayPlaceholder = `${micListeningHint} ${interimTranscript}`.trim()
  }

  let errorMessage: string | null = null
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    errorMessage = micPermissionDenied
  } else if (error && error !== 'no-speech' && error !== 'aborted') {
    errorMessage = micErrorGeneric
  }

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
          placeholder={displayPlaceholder}
          aria-label={inputAriaLabel}
        />
        {isSupported ? (
          <button
            type="button"
            onClick={toggle}
            disabled={isSending}
            className={`rounded-xl p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isListening
                ? 'animate-pulse bg-red-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            aria-label={isListening ? micStopAriaLabel : micStartAriaLabel}
            aria-pressed={isListening}
          >
            {isListening ? <FiMicOff /> : <FiMic />}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => onSend()}
          className="rounded-xl bg-blue-500 p-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          aria-label={sendAriaLabel}
        >
          <FiSend />
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}
