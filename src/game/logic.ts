import type { Direction, GameState, MoveResult, Position, Rng, Tile } from './types'

export const DEFAULT_SIZE = 4
export const WIN_VALUE = 2048
/** Chance that a spawned tile is a 4 instead of a 2. */
export const FOUR_PROBABILITY = 0.1

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']

export function emptyCells(tiles: readonly Tile[], size: number): Position[] {
  const taken = new Set(tiles.map((t) => t.row * size + t.col))
  const cells: Position[] = []
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!taken.has(row * size + col)) cells.push({ row, col })
    }
  }
  return cells
}

/**
 * Adds a 2 (or, rarely, a 4) to a random empty cell.
 * Returns the state unchanged and `null` when the board is full.
 */
export function spawnTile(state: GameState, rng: Rng = Math.random): { state: GameState; tile: Tile | null } {
  const cells = emptyCells(state.tiles, state.size)
  if (cells.length === 0) return { state, tile: null }
  const cell = cells[Math.floor(rng() * cells.length)]!
  const value = rng() < FOUR_PROBABILITY ? 4 : 2
  const tile: Tile = { id: state.nextId, value, row: cell.row, col: cell.col, isNew: true }
  return {
    state: {
      ...state,
      tiles: [...state.tiles, tile],
      nextId: state.nextId + 1,
      bestTile: Math.max(state.bestTile, value),
    },
    tile,
  }
}

export function newGame(size = DEFAULT_SIZE, rng: Rng = Math.random): GameState {
  let state: GameState = {
    size,
    tiles: [],
    score: 0,
    bestTile: 0,
    nextId: 1,
    won: false,
    keepPlaying: false,
    over: false,
  }
  state = spawnTile(state, rng).state
  state = spawnTile(state, rng).state
  return state
}

/**
 * Cells of every line along `direction`, each ordered from the edge tiles move
 * towards. Moving left, row 0 is [(0,0), (0,1), (0,2), (0,3)].
 */
function lines(size: number, direction: Direction): Position[][] {
  const result: Position[][] = []
  for (let i = 0; i < size; i++) {
    const line: Position[] = []
    for (let j = 0; j < size; j++) {
      switch (direction) {
        case 'left':
          line.push({ row: i, col: j })
          break
        case 'right':
          line.push({ row: i, col: size - 1 - j })
          break
        case 'up':
          line.push({ row: j, col: i })
          break
        case 'down':
          line.push({ row: size - 1 - j, col: i })
          break
      }
    }
    result.push(line)
  }
  return result
}

/**
 * Slides tiles in `direction` and merges equal neighbours, without spawning.
 * Each tile merges at most once per move, and merges resolve from the leading
 * edge: [2, 2, 2, 2] moving left becomes [4, 4], and [2, 2, 4] becomes [4, 4].
 */
export function slide(state: GameState, direction: Direction): Omit<MoveResult, 'spawned'> {
  const { size } = state
  const byCell = new Map<number, Tile>()
  for (const t of state.tiles) byCell.set(t.row * size + t.col, t)

  let nextId = state.nextId
  let scoreGained = 0
  let moved = false
  const merges: number[] = []
  const tiles: Tile[] = []

  for (const line of lines(size, direction)) {
    const occupied = line.map((p) => byCell.get(p.row * size + p.col)).filter((t): t is Tile => t !== undefined)
    let target = 0
    for (let k = 0; k < occupied.length; k++) {
      const current = occupied[k]!
      const next = occupied[k + 1]
      const dest = line[target]!
      if (next && next.value === current.value) {
        const value = current.value * 2
        tiles.push({ id: nextId++, value, row: dest.row, col: dest.col, mergedFrom: [current.id, next.id] })
        scoreGained += value
        merges.push(value)
        moved = true
        k++
      } else {
        if (current.row !== dest.row || current.col !== dest.col) moved = true
        tiles.push({ id: current.id, value: current.value, row: dest.row, col: dest.col })
      }
      target++
    }
  }

  if (!moved) {
    return { state, moved: false, scoreGained: 0, merges: [] }
  }

  const bestTile = tiles.reduce((max, t) => Math.max(max, t.value), state.bestTile)
  return {
    state: { ...state, tiles, nextId, score: state.score + scoreGained, bestTile },
    moved: true,
    scoreGained,
    merges,
  }
}

export function canMove(state: GameState): boolean {
  const { size, tiles } = state
  if (tiles.length < size * size) return true
  const grid = toGrid(state)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = grid[row]![col]
      if (col + 1 < size && grid[row]![col + 1] === value) return true
      if (row + 1 < size && grid[row + 1]![col] === value) return true
    }
  }
  return false
}

export function hasWon(state: GameState, target = WIN_VALUE): boolean {
  return state.tiles.some((t) => t.value >= target)
}

/**
 * Full turn: slide, spawn a tile if anything moved, then update win and
 * game-over flags. A move that changes nothing returns the same state object.
 */
export function move(state: GameState, direction: Direction, rng: Rng = Math.random): MoveResult {
  if (state.over || (state.won && !state.keepPlaying)) {
    return { state, moved: false, scoreGained: 0, merges: [], spawned: null }
  }
  const slid = slide(state, direction)
  if (!slid.moved) return { ...slid, spawned: null }

  const { state: spawnedState, tile } = spawnTile(slid.state, rng)
  const next: GameState = {
    ...spawnedState,
    won: spawnedState.won || hasWon(spawnedState),
  }
  next.over = !canMove(next)
  return { state: next, moved: true, scoreGained: slid.scoreGained, merges: slid.merges, spawned: tile }
}

/** Lets the player continue after reaching 2048. */
export function continueAfterWin(state: GameState): GameState {
  return { ...state, keepPlaying: true }
}

/** Board as a `size` x `size` matrix of values, 0 for empty. */
export function toGrid(state: Pick<GameState, 'size' | 'tiles'>): number[][] {
  const grid = Array.from({ length: state.size }, () => Array<number>(state.size).fill(0))
  for (const t of state.tiles) grid[t.row]![t.col] = t.value
  return grid
}

/** Builds a state from a value matrix (0 = empty). Handy for tests and fixtures. */
export function fromGrid(grid: number[][], extra: Partial<GameState> = {}): GameState {
  const size = grid.length
  const tiles: Tile[] = []
  let id = 1
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value) tiles.push({ id: id++, value, row: r, col: c })
    }),
  )
  return {
    size,
    tiles,
    score: 0,
    bestTile: tiles.reduce((m, t) => Math.max(m, t.value), 0),
    nextId: id,
    won: false,
    keepPlaying: false,
    over: false,
    ...extra,
  }
}
