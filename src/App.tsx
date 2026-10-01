import { RotateCcw } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { describeMove, describeOutcome } from './announce'
import { Board } from './components/Board'
import { CheerButton } from './components/CheerButton'
import { DirectionPad } from './components/DirectionPad'
import { Outcome } from './components/Outcome'
import { ScoreBoard } from './components/ScoreBoard'
import { useGame } from './hooks/useGame'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useTimer } from './hooks/useTimer'
import { loadGame, saveGame } from './storage'
import { EffectsProvider, EffectsToggle, centerOf, fxBus, type ScoreGain } from './effects'

// PixiJS is large and purely decorative, so it loads after the game is playable.
const PixiStage = lazy(() => import('./effects/PixiStage').then((m) => ({ default: m.PixiStage })))

export default function App() {
  return (
    <EffectsProvider>
      <Suspense fallback={null}>
        <PixiStage />
      </Suspense>
      <Game />
    </EffectsProvider>
  )
}

function Game() {
  const [saved] = useState(loadGame)
  const { game, bestScore, last, seq, moves, move, restart, keepPlaying } = useGame(saved)
  const blocked = game.over || (game.won && !game.keepPlaying)
  // The clock starts on the first move and stops when the game ends or is won.
  const timer = useTimer(!blocked && moves > 0, saved?.elapsedMs)
  const elapsedSeconds = Math.floor(timer.elapsed / 1000)
  useKeyboardControls(move, !blocked)

  useEffect(() => {
    saveGame({ game, moves, bestScore, elapsedMs: elapsedSeconds * 1000 })
  }, [game, moves, bestScore, elapsedSeconds])

  const newGame = () => {
    restart()
    timer.reset()
  }

  // Alternate a trailing no-break space so screen readers re-read repeated text.
  const pad = seq % 2 ? ' ' : ''
  const status = last ? describeMove(last.direction, last.result) + pad : ''
  const outcome = describeOutcome(game, timer.elapsed)
  const gained = last?.result.moved ? last.result.scoreGained : 0
  const gains = useScoreGains(gained, seq)
  const boardArea = useRef<HTMLDivElement>(null)
  const lastMove = useMemo(() => (last ? { direction: last.direction, moved: last.result.moved, seq } : null), [last, seq])
  useOutcomeEffects(game.won, game.over, boardArea)

  return (
    <main className="kc-main">
      <header className="kc-head">
        <div>
          <p className="eyebrow">Merge the keys</p>
          <h1 className="kc-title">
            20<span className="rainbow-text">48</span>
          </h1>
        </div>
        <div className="kc-actions">
          <EffectsToggle className="btn-ghost" />
          <button type="button" onClick={newGame} className="btn-primary">
            <RotateCcw className="btn-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="btn-label">New game</span>
          </button>
        </div>
      </header>

      <ScoreBoard score={game.score} bestScore={bestScore} elapsedMs={timer.elapsed} moves={moves} gains={gains} />

      <div ref={boardArea} className="relative">
        <Board game={game} onMove={move} lastMove={lastMove} />
        <Outcome game={game} elapsedMs={timer.elapsed} onRestart={newGame} onKeepPlaying={keepPlaying} />
      </div>

      <div className="kc-foot">
        <p id="how-to-play" className="kc-hint">
          <span className="hint-keys">
            Slide to join keys and reach 2048. Use <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd>,{' '}
            <kbd className="rgb">WASD</kbd>, a swipe or the keys here.
          </span>
          <span className="hint-touch">Swipe the board to join keys and reach 2048.</span>{' '}
          Your game is saved in this browser.
        </p>
        <DirectionPad onMove={move} disabled={blocked} />
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </div>
      <div role="alert" aria-atomic="true" className="sr-only">
        {outcome}
      </div>

      <CheerButton />
    </main>
  )
}

/**
 * The last few per-move score gains, for the floating "+N" labels. Old ones
 * have already faded out, so the list only needs a cap, not timers.
 */
function useScoreGains(amount: number, seq: number) {
  const [state, setState] = useState<{ seq: number; gains: ScoreGain[] }>({ seq, gains: [] })
  if (state.seq !== seq) {
    const gains = amount > 0 ? [...state.gains.slice(-3), { id: seq, amount }] : state.gains
    setState({ seq, gains })
  }
  return state.gains
}

/** Confetti on a win, dimmed background on game over, reset on a new game. */
function useOutcomeEffects(won: boolean, over: boolean, area: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (won && area.current) fxBus.emit({ type: 'win', ...centerOf(area.current) })
  }, [won, area])
  useEffect(() => {
    fxBus.emit({ type: over ? 'gameOver' : 'reset' })
  }, [over])
}
