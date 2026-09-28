import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AnimatedNumber, EffectsProvider, EffectsToggle, ScorePopups } from '.'
import { PixiStage } from './PixiStage'

describe('effects', () => {
  afterEach(() => localStorage.clear())

  it('keeps the Pixi canvas host out of the accessibility tree', () => {
    const { container } = render(<PixiStage />)
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows score popups visually only', () => {
    render(<ScorePopups gains={[{ id: 1, amount: 8 }, { id: 2, amount: 0 }]} />)
    const popup = screen.getByText('+8')
    expect(popup.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByText('+0')).toBeNull()
  })

  it('gives screen readers only the final score', () => {
    render(<AnimatedNumber value={1234} />)
    const visible = screen.getAllByText('1,234')
    expect(visible.some((el) => !el.closest('[aria-hidden="true"]'))).toBe(true)
  })

  it('lets players turn effects down and remembers the choice', async () => {
    render(
      <EffectsProvider>
        <EffectsToggle />
      </EffectsProvider>,
    )
    const toggle = screen.getByRole('button', { name: /effects/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('fx-level')).toBe('reduced')
  })
})
