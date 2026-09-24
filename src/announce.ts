import type { Direction, GameState, MoveResult } from './game'
import { describeDuration } from './hooks/useTimer'

/** Text for the polite live region after a move attempt. */
export function describeMove(direction: Direction, result: MoveResult): string {
  if (!result.moved) return `Can't move ${direction}.`
  const parts = [`Moved ${direction}.`]
  if (result.merges.length > 0) {
    const values = [...result.merges].sort((a, b) => b - a).join(', ')
    parts.push(`Merged ${values}.`)
  }
  parts.push(`Score ${result.state.score}${result.scoreGained ? `, plus ${result.scoreGained}` : ''}.`)
  if (result.spawned) {
    parts.push(`New ${result.spawned.value} at row ${result.spawned.row + 1}, column ${result.spawned.col + 1}.`)
  }
  return parts.join(' ')
}

/** Text for the assertive live region when the game ends or is won. */
export function describeOutcome(game: GameState, elapsedMs: number): string {
  const time = describeDuration(elapsedMs)
  if (game.over) return `Game over. Final score ${game.score}. Best tile ${game.bestTile}. Time ${time}.`
  if (game.won && !game.keepPlaying) return `You made 2048! Score ${game.score}. Time ${time}.`
  return ''
}
