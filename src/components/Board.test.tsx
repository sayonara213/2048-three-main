import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Board } from './Board'
import { fromGrid } from '../game'

describe('Board', () => {
  it('falls back to flat keycaps without WebGL, hidden from assistive tech', () => {
    const game = fromGrid([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2048]])
    const { container } = render(<Board game={game} onMove={vi.fn()} />)
    expect(container.querySelector('.board')).toHaveClass('is-flat')
    expect(document.querySelector('canvas')).toBeNull()
    const cells = screen.getAllByRole('cell').map((c) => c.textContent)
    expect(cells[0]).toBe('2')
    expect(cells[15]).toBe('2048')
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
