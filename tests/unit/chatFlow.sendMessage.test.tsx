import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('Chat flow', () => {
  it('appends user message, clears input and renders assistant response', async () => {
    vi.stubEnv('VITE_AI_API_URL', 'https://example.test/chat')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Claro, este es el análisis solicitado.' } }],
      }),
    } as Response)

    render(<App />)

    const input = screen.getByRole('textbox', { name: /entrada de chat/i })
    fireEvent.change(input, { target: { value: 'Analyze SPY trend' } })

    const sendButton = screen.getByRole('button', { name: /enviar mensaje/i })
    fireEvent.click(sendButton)

    expect(screen.getByText('Analyze SPY trend')).toBeInTheDocument()
    expect(input).toHaveValue('')

    await waitFor(() => {
      expect(screen.getByText('Claro, este es el análisis solicitado.')).toBeInTheDocument()
    })
  })
})
