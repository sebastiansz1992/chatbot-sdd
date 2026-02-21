import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('Sidebar models and insights', () => {
  it('renders exactly one selected model and model selector content', () => {
    const { container } = render(<App />)

    const selectedModels = container.querySelectorAll('[aria-pressed="true"]')
    expect(selectedModels.length).toBe(1)

    expect(screen.getByRole('region', { name: /selector de modelo/i })).toBeInTheDocument()
    expect(screen.getByText(/fingpt expert/i)).toBeInTheDocument()
    expect(screen.getByText(/claude analyst/i)).toBeInTheDocument()
    expect(screen.getByText(/gemini quant/i)).toBeInTheDocument()
  })
})
