import { useCallback, useReducer } from 'react'
import { continueAfterWin, move, newGame } from '../game'
import type { Direction, GameState, MoveResult } from '../game'
import type { SavedGame } from '../storage'

interface Store {
  game: GameState
  /** Highest score reached across games. */
  bestScore: number
  /** Result of the most recent move attempt, used for announcements and the +score badge. */
  last: { direction: Direction; result: MoveResult } | null
  /** Bumped on every action so identical announcements are still re-read. */
  seq: number
  /** Successful moves in the current game. */
  moves: number
}

type Action = { type: 'move'; direction: Direction } | { type: 'new' } | { type: 'continue' }

function reducer(store: Store, action: Action): Store {
  switch (action.type) {
    case 'move': {
      const result = move(store.game, action.direction)
      return {
        ...store,
        game: result.state,
        bestScore: Math.max(store.bestScore, result.state.score),
        moves: store.moves + (result.moved ? 1 : 0),
        last: { direction: action.direction, result },
        seq: store.seq + 1,
      }
    }
    case 'new':
      return {
        ...store,
        game: newGame(store.game.size),
        last: null,
        seq: store.seq + 1,
        moves: 0,
      }
    case 'continue':
      return { ...store, game: continueAfterWin(store.game), seq: store.seq + 1 }
  }
}

export function useGame(saved: SavedGame | null = null, size?: number) {
  const [store, dispatch] = useReducer(reducer, null, () => ({
    game: saved?.game ?? newGame(size),
    bestScore: saved?.bestScore ?? 0,
    last: null,
    seq: 0,
    moves: saved?.moves ?? 0,
  }))
  return {
    ...store,
    move: useCallback((direction: Direction) => dispatch({ type: 'move', direction }), []),
    restart: useCallback(() => dispatch({ type: 'new' }), []),
    keepPlaying: useCallback(() => dispatch({ type: 'continue' }), []),
  }
}
