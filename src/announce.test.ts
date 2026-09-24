import { describe, expect, it } from 'vitest'
import { describeMove, describeOutcome } from './announce'
import { fromGrid, move, slide } from './game'

describe('announcements', () => {
  it('describes merges, score and the spawned tile', () => {
    const s = fromGrid([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    const r = move(s, 'left', () => 0.5)
    expect(describeMove('left', r)).toBe(
      `Moved left. Merged 8, 4. Score 12, plus 12. New 2 at row ${r.spawned!.row + 1}, column ${r.spawned!.col + 1}.`,
    )
  })

  it('says when a move is blocked', () => {
    const s = fromGrid([[2, 0], [0, 0]])
    expect(describeMove('left', { ...slide(s, 'left'), spawned: null })).toBe("Can't move left.")
  })

  it('describes game over and wins', () => {
    expect(describeOutcome(fromGrid([[2, 4], [8, 16]], { over: true, score: 30 }), 61_000)).toBe(
      'Game over. Final score 30. Best tile 16. Time 1 minute 1 second.',
    )
    expect(describeOutcome(fromGrid([[2048, 0], [0, 0]], { won: true, score: 20000 }), 3_725_000)).toBe(
      'You made 2048! Score 20000. Time 1 hour 2 minutes 5 seconds.',
    )
    expect(describeOutcome(fromGrid([[2048, 0], [0, 0]], { won: true, keepPlaying: true }), 0)).toBe('')
  })
})
