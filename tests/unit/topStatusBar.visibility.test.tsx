import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('Top status bar', () => {
  it('shows encryption and active session indicators', () => {
    render(<App />)

    expect(screen.getByText(/Cifrado de extremo a extremo/i)).toBeInTheDocument()
    expect(screen.getByText(/Sesión activa/i)).toBeInTheDocument()
    expect(screen.getByText(/Conectado a OpenAI/i)).toBeInTheDocument()
  })
})
