import type { Direction } from '../game'

const BUTTONS: { direction: Direction; glyph: string; label: string; area: string }[] = [
  { direction: 'up', glyph: '↑', label: 'Move up', area: 'col-start-2 row-start-1' },
  { direction: 'left', glyph: '←', label: 'Move left', area: 'col-start-1 row-start-2' },
  { direction: 'down', glyph: '↓', label: 'Move down', area: 'col-start-2 row-start-2' },
  { direction: 'right', glyph: '→', label: 'Move right', area: 'col-start-3 row-start-2' },
]

/** On-screen controls for switch, screen reader and pointer-only players. */
export function DirectionPad({ onMove, disabled }: { onMove: (d: Direction) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Move tiles" className="kc-dpad">
      {BUTTONS.map((b) => (
        <button
          key={b.direction}
          type="button"
          aria-label={b.label}
          disabled={disabled}
          onClick={() => onMove(b.direction)}
          className={`keybtn ${b.area}`}
        >
          <span aria-hidden="true">{b.glyph}</span>
        </button>
      ))}
    </div>
  )
}
