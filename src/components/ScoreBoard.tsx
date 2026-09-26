import type { ReactNode } from 'react'
import { describeDuration, formatDuration } from '../hooks/useTimer'
import { AnimatedNumber, ScorePopups, type ScoreGain } from '../effects'

interface ScoreBoardProps {
  score: number
  bestScore: number
  elapsedMs: number
  moves: number
  /** Points from recent moves, shown as floating "+N" labels. */
  gains: ScoreGain[]
}

export function ScoreBoard({ score, bestScore, elapsedMs, moves, gains }: ScoreBoardProps) {
  return (
    <dl className="kc-stats">
      <Stat label="Score">
        <AnimatedNumber value={score} />
        <ScorePopups gains={gains} />
      </Stat>
      <Stat label="Best">
        <AnimatedNumber value={bestScore} />
      </Stat>
      <Stat label="Time">
        {/* role=timer is not live, so the ticking clock is never read out on its own. */}
        <span role="timer" aria-label={describeDuration(elapsedMs)}>
          {formatDuration(elapsedMs)}
        </span>
      </Stat>
      <Stat label="Moves">{moves.toLocaleString()}</Stat>
    </dl>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kc-stat">
      <dt className="kc-stat-label">{label}</dt>
      <dd className="kc-stat-value">{children}</dd>
    </div>
  )
}
