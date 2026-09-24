import { describe, expect, it } from 'vitest'
import {
  canMove,
  continueAfterWin,
  emptyCells,
  fromGrid,
  hasWon,
  move,
  newGame,
  slide,
  spawnTile,
  toGrid,
} from './logic'

/** Rng that replays the given values in order, then repeats the last one. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]!
}

describe('slide', () => {
  it('slides tiles to the edge', () => {
    const s = fromGrid([
      [0, 0, 0, 2],
      [0, 4, 0, 0],
      [0, 0, 0, 0],
      [8, 0, 0, 0],
    ])
    expect(toGrid(slide(s, 'left').state)).toEqual([
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [8, 0, 0, 0],
    ])
    expect(toGrid(slide(s, 'down').state)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [8, 4, 0, 2],
    ])
  })

  it.each([
    ['[2,2,2,2] -> [4,4]', [2, 2, 2, 2], [4, 4, 0, 0]],
    ['[2,2,4,0] merges once, not into 8', [2, 2, 4, 0], [4, 4, 0, 0]],
    ['[4,4,8,0] -> [8,8]', [4, 4, 8, 0], [8, 8, 0, 0]],
    ['[2,0,0,2] across gaps', [2, 0, 0, 2], [4, 0, 0, 0]],
    ['[2,2,2,0] merges the leading pair', [2, 2, 2, 0], [4, 2, 0, 0]],
    ['[2,4,2,4] does not merge', [2, 4, 2, 4], [2, 4, 2, 4]],
  ])('left: %s', (_, row, expected) => {
    const s = fromGrid([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    expect(toGrid(slide(s, 'left').state)[0]).toEqual(expected)
  })

  it('merges from the leading edge when moving right', () => {
    const s = fromGrid([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    expect(toGrid(slide(s, 'right').state)[0]).toEqual([0, 0, 2, 4])
  })

  it('merges from the leading edge when moving up', () => {
    const s = fromGrid([[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]])
    expect(toGrid(slide(s, 'up').state).map((r) => r[0])).toEqual([4, 2, 0, 0])
  })

  it('adds merged values to the score and reports merges', () => {
    const s = fromGrid([[2, 2, 4, 4], [8, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { score: 10 })
    const r = slide(s, 'left')
    expect(r.scoreGained).toBe(4 + 8 + 16)
    expect(r.state.score).toBe(38)
    expect(r.merges.sort((a, b) => a - b)).toEqual([4, 8, 16])
    expect(r.state.bestTile).toBe(16)
  })

  it('keeps ids of slid tiles and records merge sources', () => {
    const s = fromGrid([[0, 2, 0, 2], [0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0]])
    const [a, b, c] = s.tiles
    const r = slide(s, 'left')
    const merged = r.state.tiles.find((t) => t.row === 0)!
    expect(merged.mergedFrom).toEqual([a!.id, b!.id])
    expect(merged.id).toBeGreaterThanOrEqual(s.nextId)
    expect(r.state.tiles.find((t) => t.row === 1)!.id).toBe(c!.id)
  })

  it('reports no movement and returns the same state when blocked', () => {
    const s = fromGrid([[2, 4, 0, 0], [8, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    const r = slide(s, 'left')
    expect(r.moved).toBe(false)
    expect(r.state).toBe(s)
  })
})

describe('spawnTile', () => {
  it('places a 2 in an empty cell', () => {
    const s = fromGrid([[2, 0], [0, 0]])
    const { state, tile } = spawnTile(s, seq(0, 0.5))
    expect(tile).toMatchObject({ row: 0, col: 1, value: 2, isNew: true })
    expect(state.tiles).toHaveLength(2)
    expect(state.nextId).toBe(s.nextId + 1)
  })

  it('spawns a 4 ten percent of the time', () => {
    const { tile } = spawnTile(fromGrid([[0, 0], [0, 0]]), seq(0.99, 0.05))
    expect(tile).toMatchObject({ row: 1, col: 1, value: 4 })
  })

  it('does nothing on a full board', () => {
    const s = fromGrid([[2, 4], [8, 16]])
    const r = spawnTile(s, seq(0))
    expect(r.tile).toBeNull()
    expect(r.state).toBe(s)
  })

  it('only ever picks empty cells', () => {
    const s = fromGrid([[2, 4, 8, 0], [16, 32, 64, 128], [2, 4, 8, 16], [0, 2, 4, 8]])
    for (const x of [0, 0.49, 0.5, 0.999]) {
      const { tile } = spawnTile(s, seq(x, 0.5))
      expect(emptyCells(s.tiles, 4)).toContainEqual({ row: tile!.row, col: tile!.col })
    }
  })
})

describe('newGame', () => {
  it('starts with two tiles and no score', () => {
    const s = newGame(4, seq(0, 0.5, 0, 0.5))
    expect(s.tiles).toHaveLength(2)
    expect(s.score).toBe(0)
    expect(new Set(s.tiles.map((t) => t.id)).size).toBe(2)
    expect(s.over || s.won).toBe(false)
  })

  it('supports other board sizes', () => {
    const s = newGame(5)
    expect(s.size).toBe(5)
    expect(emptyCells(s.tiles, 5)).toHaveLength(23)
  })
})

describe('move', () => {
  it('spawns exactly one tile after a successful move', () => {
    const s = fromGrid([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    const r = move(s, 'left', seq(0.5, 0.5))
    expect(r.moved).toBe(true)
    expect(r.spawned).not.toBeNull()
    expect(r.state.tiles).toHaveLength(2)
  })

  it('does not spawn when nothing moves', () => {
    const s = fromGrid([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    const r = move(s, 'left')
    expect(r.moved).toBe(false)
    expect(r.spawned).toBeNull()
    expect(r.state).toBe(s)
  })

  it('flags a win when 2048 is made, and blocks moves until the player continues', () => {
    const s = fromGrid([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    const won = move(s, 'left', seq(0.5, 0.5)).state
    expect(won.won).toBe(true)
    expect(move(won, 'right').moved).toBe(false)
    expect(move(continueAfterWin(won), 'right').moved).toBe(true)
  })

  it('flags game over when the spawned tile fills a stuck board', () => {
    // After moving left, the only empty cell is (3,3); a spawned 2 there leaves no moves.
    const s = fromGrid([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [0, 4, 8, 16],
    ])
    const r = move(s, 'left', seq(0, 0.5))
    expect(toGrid(r.state)[3]).toEqual([4, 8, 16, 2])
    expect(r.state.over).toBe(true)
    expect(move(r.state, 'up').moved).toBe(false)
  })
})

describe('canMove / hasWon', () => {
  it('is true while any cell is empty', () => {
    expect(canMove(fromGrid([[2, 4], [8, 0]]))).toBe(true)
  })

  it('is true on a full board with an adjacent pair', () => {
    expect(canMove(fromGrid([[2, 4], [8, 4]]))).toBe(true)
    expect(canMove(fromGrid([[2, 2], [8, 4]]))).toBe(true)
  })

  it('is false on a full board with no pairs', () => {
    expect(canMove(fromGrid([[2, 4], [8, 16]]))).toBe(false)
  })

  it('detects the winning tile', () => {
    expect(hasWon(fromGrid([[2048, 0], [0, 0]]))).toBe(true)
    expect(hasWon(fromGrid([[1024, 0], [0, 0]]))).toBe(false)
  })
})
