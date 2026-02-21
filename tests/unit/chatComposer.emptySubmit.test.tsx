import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('Chat composer empty submit', () => {
  it('keeps send disabled and does not add user message for empty input', () => {
    render(<App />)

    const sendButton = screen.getByRole('button', { name: /enviar mensaje/i })
    expect(sendButton).toBeDisabled()

    fireEvent.click(sendButton)
    expect(screen.getAllByTestId('message-assistant')).toHaveLength(1)
    expect(screen.queryAllByTestId('message-user')).toHaveLength(0)
  })
})
