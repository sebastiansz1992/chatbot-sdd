import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language } from '../../i18n/translations'

type SpeechRecognitionAlternative = { transcript: string; confidence: number }
type SpeechRecognitionResult = {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
type SpeechRecognitionResultList = {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
type SpeechRecognitionEvent = {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
type SpeechRecognitionErrorEvent = { readonly error: string; readonly message?: string }

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getConstructor(): SpeechRecognitionConstructor | null {
  if (globalThis.window === undefined) return null
  const w = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const LANGUAGE_MAP: Record<Language, string> = {
  es: 'es-CO',
  en: 'en-US',
}

type UseSpeechRecognitionOptions = {
  language: Language
  onFinalTranscript?: (text: string) => void
}

export function useSpeechRecognition({ language, onFinalTranscript }: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onFinalTranscriptRef = useRef(onFinalTranscript)

  const [isSupported] = useState(() => Boolean(getConstructor()))
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getConstructor()
    if (!Ctor) {
      setError('unsupported')
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    const instance = new Ctor()
    instance.lang = LANGUAGE_MAP[language]
    instance.continuous = false
    instance.interimResults = true
    instance.maxAlternatives = 1

    instance.onstart = () => {
      setError(null)
      setInterimTranscript('')
      setIsListening(true)
    }

    instance.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          final += text
        } else {
          interim += text
        }
      }

      if (final.trim()) {
        setInterimTranscript('')
        onFinalTranscriptRef.current?.(final.trim())
      } else {
        setInterimTranscript(interim)
      }
    }

    instance.onerror = (event) => {
      setError(event.error || 'error')
      setIsListening(false)
    }

    instance.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
      recognitionRef.current = null
    }

    recognitionRef.current = instance

    try {
      instance.start()
    } catch {
      setError('start-failed')
      setIsListening(false)
      recognitionRef.current = null
    }
  }, [language])

  const toggle = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      start()
    }
  }, [isListening, start, stop])

  return { isSupported, isListening, interimTranscript, error, start, stop, toggle }
}
