import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Direction, GameState, Tile } from '../game'
import { toGrid } from '../game'
import { useSwipe } from '../hooks/useSwipe'
import { AnimatedTile } from '../effects'

// Three.js is large and decorative, so the 3D keyboard loads after the game is playable.
const KeyboardStage = lazy(() => import('../three/KeyboardStage'))

export interface LastMove {
  direction: Direction
  moved: boolean
  seq: number
}

interface BoardProps {
  game: GameState
  onMove: (direction: Direction) => void
  lastMove?: LastMove | null
}

type Mode = 'pending' | '3d' | 'flat'

function hasWebGL() {
  if (typeof WebGLRenderingContext === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * The board has two layers. A read-only table exposes the cell values to
 * assistive tech in reading order. The visual layer is the 3D keyboard drawn
 * on a WebGL canvas behind this slot, or flat keycaps in the DOM when WebGL is
 * unavailable. Both are hidden from the accessibility tree.
 */
export function Board({ game, onMove, lastMove = null }: BoardProps) {
  const swipe = useSwipe(onMove)
  const grid = toGrid(game)
  const { size } = game
  const board = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>(() => (hasWebGL() ? 'pending' : 'flat'))
  const onReady = useCallback(() => setMode('3d'), [])
  const onError = useCallback(() => setMode('flat'), [])

  return (
    <div
      {...swipe}
      ref={board}
      className={`board relative aspect-square w-full touch-none select-none p-[var(--gap)] is-${mode}`}
      style={{ '--size': size } as CSSProperties}
    >
      <div role="table" aria-label={`Game board, ${size} by ${size}`} className="grid h-full gap-[var(--gap)]">
        {grid.map((row, r) => (
          <div role="row" key={r} className="grid grid-cols-[repeat(var(--size),1fr)] gap-[var(--gap)]">
            {row.map((value, c) => (
              <div role="cell" key={c} className="kc-cell">
                <span className="sr-only">{value || 'empty'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {mode !== 'flat' && (
        <Suspense fallback={null}>
          <KeyboardStage
            slot={board}
            size={size}
            tiles={game.tiles}
            over={game.over}
            won={game.won && !game.keepPlaying}
            lastMove={lastMove}
            onReady={onReady}
            onError={onError}
          />
        </Suspense>
      )}
      {mode === 'flat' && <FlatTiles game={game} />}
    </div>
  )
}

/** DOM keycaps that slide between cells, used when WebGL is unavailable. */
function FlatTiles({ game }: { game: GameState }) {
  const layer = useRef<HTMLDivElement>(null)
  const { cell, gap } = useCellSize(layer, game.size)

  // Tiles swallowed by this move's merges: keep them one more render, at the
  // merge destination, so they slide in under the merged tile.
  const [history, setHistory] = useState({ tiles: game.tiles, prev: [] as Tile[] })
  if (history.tiles !== game.tiles) setHistory({ tiles: game.tiles, prev: history.tiles })
  const ghosts = useMemo(() => {
    const prev = new Map(history.prev.map((t) => [t.id, t]))
    const out: Tile[] = []
    for (const t of game.tiles) {
      for (const id of t.mergedFrom ?? []) {
        const src = prev.get(id)
        if (src) out.push({ ...src, row: t.row, col: t.col, isNew: false, mergedFrom: undefined })
      }
    }
    return out
  }, [game.tiles, history.prev])

  return (
    <div ref={layer} aria-hidden="true" className="pointer-events-none absolute inset-[var(--gap)]">
      {cell > 0 && (
        <AnimatePresence>
          {ghosts.map((t) => (
            <AnimatedTile key={t.id} {...t} cell={cell} gap={gap} ghost />
          ))}
          {game.tiles.map((t) => (
            <AnimatedTile
              key={t.id}
              value={t.value}
              row={t.row}
              col={t.col}
              cell={cell}
              gap={gap}
              isNew={t.isNew}
              merged={!!t.mergedFrom}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}

/** Measures one cell and the gap in px, tracking resizes. */
function useCellSize(layer: RefObject<HTMLDivElement | null>, size: number) {
  const [dims, setDims] = useState({ cell: 0, gap: 0 })
  useLayoutEffect(() => {
    const l = layer.current
    const b = l?.parentElement
    if (!l || !b) return
    const measure = () => {
      const gap = parseFloat(getComputedStyle(b).paddingLeft) || 0
      const cell = (l.clientWidth - (size - 1) * gap) / size
      setDims((d) => (d.cell === cell && d.gap === gap ? d : { cell, gap }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(l)
    return () => ro.disconnect()
  }, [layer, size])
  return dims
}
