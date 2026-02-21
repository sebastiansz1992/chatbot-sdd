import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('Theme toggle', () => {
  it('toggles dark mode manually and persists user preference', () => {
    localStorage.removeItem('fibot-theme')
    document.documentElement.classList.remove('dark')

    render(<App />)

    const toggleButton = screen.getByRole('button', { name: /cambiar tema/i })
    expect(document.documentElement).not.toHaveClass('dark')

    fireEvent.click(toggleButton)

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('fibot-theme')).toBe('dark')

    fireEvent.click(toggleButton)

    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('fibot-theme')).toBe('light')
  })
})
