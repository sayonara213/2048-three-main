export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Position {
  row: number
  col: number
}

export interface Tile extends Position {
  /** Stable identity, so the UI can animate a tile as it slides. */
  id: number
  value: number
  /** Ids of the two tiles that merged into this one on the last move. */
  mergedFrom?: [number, number]
  /** True for the tile spawned after the last move. */
  isNew?: boolean
}

export interface GameState {
  size: number
  tiles: Tile[]
  score: number
  bestTile: number
  /** Counter used to hand out tile ids, kept in state so moves stay pure. */
  nextId: number
  /** Reached the target tile at least once. */
  won: boolean
  /** Player chose to continue after winning. */
  keepPlaying: boolean
  /** No moves left. */
  over: boolean
}

export interface MoveResult {
  state: GameState
  moved: boolean
  scoreGained: number
  /** Values of the tiles created by merges on this move. */
  merges: number[]
  spawned: Tile | null
}

/** Returns a float in [0, 1), like Math.random. Injected for deterministic tests. */
export type Rng = () => number
