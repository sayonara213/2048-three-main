import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromGrid } from './game'
import { STORAGE_KEY, loadGame, parseSave, saveGame } from './storage'

const game = fromGrid([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 0]], { score: 12 })

describe('storage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips a game', () => {
    saveGame({ game, elapsedMs: 5000, moves: 3, bestScore: 40 })
    expect(loadGame()).toEqual({ game, elapsedMs: 5000, moves: 3, bestScore: 40 })
  })

  it('drops animation flags on load', () => {
    const flagged = { ...game, tiles: game.tiles.map((t) => ({ ...t, isNew: true, mergedFrom: [1, 2] as [number, number] })) }
    saveGame({ game: flagged, elapsedMs: 0, moves: 0, bestScore: 0 })
    expect(loadGame()!.game.tiles.every((t) => !t.isNew && !t.mergedFrom)).toBe(true)
  })

  it('keeps best score at least the current score', () => {
    saveGame({ game, elapsedMs: 0, moves: 0, bestScore: 0 })
    expect(loadGame()!.bestScore).toBe(12)
  })

  it.each([
    ['missing', null],
    ['not JSON', '{oops'],
    ['wrong shape', '{"game":42}'],
    ['bad tile value', JSON.stringify({ game: { ...game, tiles: [{ id: 1, row: 0, col: 0, value: 3 }] } })],
    ['tile off board', JSON.stringify({ game: { ...game, tiles: [{ id: 1, row: 4, col: 0, value: 2 }] } })],
    ['overlapping tiles', JSON.stringify({ game: { ...game, tiles: [{ id: 1, row: 0, col: 0, value: 2 }, { id: 2, row: 0, col: 0, value: 4 }] } })],
    ['empty board', JSON.stringify({ game: { ...game, tiles: [] } })],
  ])('rejects %s data', (_, json) => {
    expect(parseSave(json)).toBeNull()
  })

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(loadGame()).toBeNull()
    expect(() => saveGame({ game, elapsedMs: 0, moves: 0, bestScore: 0 })).not.toThrow()
  })

  it('uses a versioned key', () => {
    expect(STORAGE_KEY).toMatch(/v1$/)
  })
})
