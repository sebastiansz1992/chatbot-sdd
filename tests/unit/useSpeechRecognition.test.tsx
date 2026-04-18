import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechRecognition } from '../../src/components/chat/useSpeechRecognition'

type Handler<T> = ((event: T) => void) | null

type MockInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: Handler<{ resultIndex: number; results: Array<Array<{ transcript: string }> & { isFinal: boolean }> }>
  onerror: Handler<{ error: string }>
  onend: (() => void) | null
  onstart: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
}

let lastInstance: MockInstance | null = null

function createMockInstance(): MockInstance {
  const instance: MockInstance = {
    lang: '',
    continuous: false,
    interimResults: false,
    maxAlternatives: 0,
    onresult: null,
    onerror: null,
    onend: null,
    onstart: null,
    start: vi.fn(() => {
      instance.onstart?.()
    }),
    stop: vi.fn(() => {
      instance.onend?.()
    }),
    abort: vi.fn(() => {
      instance.onend?.()
    }),
  }
  return instance
}

beforeEach(() => {
  lastInstance = null
  ;(window as unknown as { SpeechRecognition: new () => MockInstance }).SpeechRecognition =
    function () {
      lastInstance = createMockInstance()
      return lastInstance
    } as unknown as new () => MockInstance
})

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  vi.restoreAllMocks()
})

describe('useSpeechRecognition', () => {
  it('reports supported when SpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechRecognition({ language: 'es' }))
    expect(result.current.isSupported).toBe(true)
  })

  it('reports unsupported when no API present', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    const { result } = renderHook(() => useSpeechRecognition({ language: 'es' }))
    expect(result.current.isSupported).toBe(false)
  })

  it('configures language, starts and delivers final transcript', () => {
    const onFinalTranscript = vi.fn()
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinalTranscript }),
    )

    act(() => {
      result.current.start()
    })

    expect(lastInstance).not.toBeNull()
    expect(lastInstance!.lang).toBe('en-US')
    expect(lastInstance!.interimResults).toBe(true)
    expect(lastInstance!.start).toHaveBeenCalled()
    expect(result.current.isListening).toBe(true)

    act(() => {
      const results = [Object.assign([{ transcript: 'hello world' }], { isFinal: true })]
      lastInstance!.onresult?.({ resultIndex: 0, results: results as never })
    })

    expect(onFinalTranscript).toHaveBeenCalledWith('hello world')

    act(() => {
      lastInstance!.onend?.()
    })

    expect(result.current.isListening).toBe(false)
  })

  it('exposes interim transcript while listening', () => {
    const { result } = renderHook(() => useSpeechRecognition({ language: 'es' }))

    act(() => {
      result.current.start()
    })

    act(() => {
      const results = [Object.assign([{ transcript: 'hola' }], { isFinal: false })]
      lastInstance!.onresult?.({ resultIndex: 0, results: results as never })
    })

    expect(result.current.interimTranscript).toBe('hola')
  })

  it('captures permission errors', () => {
    const { result } = renderHook(() => useSpeechRecognition({ language: 'es' }))

    act(() => {
      result.current.start()
    })

    act(() => {
      lastInstance!.onerror?.({ error: 'not-allowed' })
    })

    expect(result.current.error).toBe('not-allowed')
    expect(result.current.isListening).toBe(false)
  })

  it('toggle stops when listening', () => {
    const { result } = renderHook(() => useSpeechRecognition({ language: 'es' }))

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isListening).toBe(true)

    act(() => {
      result.current.toggle()
    })
    expect(lastInstance!.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
  })
})
