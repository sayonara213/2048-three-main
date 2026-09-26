import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fromGrid } from './game'
import { saveGame } from './storage'

const cellTexts = () => within(screen.getByRole('table')).getAllByRole('cell').map((c) => c.textContent)

describe('App', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders a 4x4 board with two starting tiles exposed to assistive tech', () => {
    render(<App />)
    const cells = cellTexts()
    expect(cells).toHaveLength(16)
    expect(cells.filter((t) => t !== 'empty')).toHaveLength(2)
  })

  it('moves on arrow keys and announces the result in a polite live region', async () => {
    // Deterministic spawns: always the first empty cell, always a 2.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    render(<App />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')

    const before = cellTexts()
    for (const key of ['{ArrowLeft}', '{ArrowUp}', '{ArrowRight}', '{ArrowDown}']) {
      await userEvent.keyboard(key)
      if (status.textContent?.startsWith('Moved')) break
    }
    expect(status.textContent).toMatch(/^Moved (left|up|right|down)\. .*Score \d+/)
    expect(cellTexts()).not.toEqual(before)
  })

  it('moves on swipe', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    render(<App />)
    const board = screen.getByRole('table').parentElement!
    const swipe = (dx: number, dy: number) => {
      fireEvent.pointerDown(board, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true })
      fireEvent.pointerUp(board, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 })
    }
    for (const [dx, dy] of [[-80, 0], [0, -80], [80, 0], [0, 80]] as const) {
      swipe(dx, dy)
      if (screen.getByRole('status').textContent?.startsWith('Moved')) break
    }
    expect(screen.getByRole('status').textContent).toMatch(/^Moved/)
  })

  it('offers labelled on-screen direction buttons', async () => {
    render(<App />)
    for (const name of ['Move up', 'Move down', 'Move left', 'Move right']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
    await userEvent.click(screen.getByRole('button', { name: 'Move left' }))
    expect(screen.getByRole('status').textContent).toMatch(/Moved left|Can't move left/)
  })

  it('restores a saved game and shows the points from each move', async () => {
    const game = fromGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 4]], { score: 100 })
    saveGame({ game, elapsedMs: 65_000, moves: 7, bestScore: 300 })
    render(<App />)

    expect(screen.getByText('Score').nextElementSibling).toHaveTextContent('100')
    expect(screen.getByText('Best').nextElementSibling).toHaveTextContent('300')
    expect(screen.getByRole('timer')).toHaveTextContent('1:05')
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('7')

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText('Score').nextElementSibling).toHaveTextContent('104+4')
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('8')
    expect(JSON.parse(localStorage.getItem('2048:save:v1')!).game.score).toBe(104)
  })
})
