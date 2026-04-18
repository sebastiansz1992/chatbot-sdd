import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language } from '../../i18n/translations'

const LANGUAGE_MAP: Record<Language, string> = {
  es: 'es-CO',
  en: 'en-US',
}

function stripHtmlForSpeech(value: string) {
  return value
    .replaceAll(/<img[^>]*alt="([^"]*)"[^>]*>/gi, ' $1 ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/&nbsp;/g, ' ')
    .replaceAll(/&amp;/g, '&')
    .replaceAll(/&lt;/g, '<')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function getSynth(): SpeechSynthesis | null {
  if (globalThis.window === undefined || !('speechSynthesis' in globalThis)) return null
  return globalThis.speechSynthesis
}

export function useSpeechSynthesis(language: Language) {
  const synthRef = useRef<SpeechSynthesis | null>(getSynth())
  const [isSupported] = useState(() => getSynth() !== null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    const synth = synthRef.current
    return () => {
      synth?.cancel()
    }
  }, [])

  const cancel = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  const speak = useCallback(
    (rawText: string) => {
      const synth = synthRef.current
      if (!synth) return

      const text = stripHtmlForSpeech(rawText)
      if (!text) return

      synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANGUAGE_MAP[language]
      utterance.rate = 1
      utterance.pitch = 1

      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      setIsSpeaking(true)
      synth.speak(utterance)
    },
    [language],
  )

  return { isSupported, isSpeaking, speak, cancel }
}
