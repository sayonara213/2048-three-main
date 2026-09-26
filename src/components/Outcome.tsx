import { useEffect, useRef } from 'react'
import type { GameState } from '../game'
import { formatDuration } from '../hooks/useTimer'

interface OutcomeProps {
  game: GameState
  elapsedMs: number
  onRestart: () => void
  onKeepPlaying: () => void
}

/** Win or game-over panel. Moves focus to its main action when it appears. */
export function Outcome({ game, elapsedMs, onRestart, onKeepPlaying }: OutcomeProps) {
  const primary = useRef<HTMLButtonElement>(null)
  const showWin = game.won && !game.keepPlaying && !game.over
  const visible = game.over || showWin

  useEffect(() => {
    if (visible) primary.current?.focus()
  }, [visible])

  if (!visible) return null

  return (
    <section
      aria-labelledby="outcome-title"
      className="kc-outcome absolute inset-0 z-10 grid place-items-center p-4"
    >
      <div className="sheet kc-outcome-sheet">
        <p className="eyebrow">{game.over ? 'No moves left' : 'You win'}</p>
        <h2 id="outcome-title" className="kc-outcome-title">
          {game.over ? 'Game over' : <>You made <span className="rainbow-text">2048</span></>}
        </h2>
        <p className="kc-outcome-body">
          Score {game.score.toLocaleString()} in {formatDuration(elapsedMs)}
        </p>
        <div className="kc-outcome-actions">
          {showWin && (
            <button ref={primary} type="button" onClick={onKeepPlaying} className="btn-primary">
              Keep playing
            </button>
          )}
          <button ref={showWin ? undefined : primary} type="button" onClick={onRestart} className={showWin ? 'btn-ghost' : 'btn-primary'}>
            {game.over ? 'Try again' : 'New game'}
          </button>
        </div>
      </div>
    </section>
  )
}
