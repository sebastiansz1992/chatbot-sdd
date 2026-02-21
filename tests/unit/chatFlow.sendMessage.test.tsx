import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('Chat flow', () => {
  it('appends user message and clears input on send', () => {
    render(<App />)

    const input = screen.getByRole('textbox', { name: /entrada de chat/i })
    fireEvent.change(input, { target: { value: 'Analyze SPY trend' } })

    const sendButton = screen.getByRole('button', { name: /enviar mensaje/i })
    fireEvent.click(sendButton)

    expect(screen.getByText('Analyze SPY trend')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })
})
