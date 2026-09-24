import type { GameState, Tile } from './game'

export const STORAGE_KEY = '2048:save:v1'

export interface SavedGame {
  game: GameState
  elapsedMs: number
  moves: number
  bestScore: number
}

const isInt = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

const isPowerOfTwo = (v: number) => v >= 2 && (v & (v - 1)) === 0

function parseTile(raw: unknown, size: number): Tile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  if (!isInt(t.id, 1) || !isInt(t.row, 0, size - 1) || !isInt(t.col, 0, size - 1) || !isInt(t.value, 2)) return null
  if (!isPowerOfTwo(t.value)) return null
  // Drop transient animation flags so a reload does not replay the last move.
  return { id: t.id, value: t.value, row: t.row, col: t.col }
}

/** Validates untrusted JSON from storage. Returns null for anything malformed. */
export function parseSave(json: string | null): SavedGame | null {
  if (!json) return null
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { game, elapsedMs, moves, bestScore } = data as Record<string, unknown>
  if (typeof game !== 'object' || game === null) return null
  const g = game as Record<string, unknown>
  if (!isInt(g.size, 2, 8) || !Array.isArray(g.tiles) || !isInt(g.score) || !isInt(g.nextId, 1)) return null
  const size = g.size
  const tiles: Tile[] = []
  const cells = new Set<number>()
  const ids = new Set<number>()
  for (const raw of g.tiles) {
    const tile = parseTile(raw, size)
    if (!tile || cells.has(tile.row * size + tile.col) || ids.has(tile.id) || tile.id >= g.nextId) return null
    cells.add(tile.row * size + tile.col)
    ids.add(tile.id)
    tiles.push(tile)
  }
  if (tiles.length === 0) return null
  return {
    game: {
      size,
      tiles,
      score: g.score,
      nextId: g.nextId,
      bestTile: tiles.reduce((m, t) => Math.max(m, t.value), isInt(g.bestTile) ? g.bestTile : 0),
      won: g.won === true,
      keepPlaying: g.keepPlaying === true,
      over: g.over === true,
    },
    elapsedMs: isInt(elapsedMs) ? elapsedMs : 0,
    moves: isInt(moves) ? moves : 0,
    bestScore: Math.max(isInt(bestScore) ? bestScore : 0, g.score),
  }
}

// Storage can be missing or throw (private mode, blocked site data, quota), so
// every access is guarded and the game simply runs unsaved.
export function loadGame(): SavedGame | null {
  try {
    return parseSave(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveGame(save: SavedGame): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Ignore: saving is best effort.
  }
}
