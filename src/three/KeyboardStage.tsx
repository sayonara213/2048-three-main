import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Direction, Tile } from '../game'
import { fxBus } from '../effects/fxBus'
import { useEffects } from '../effects/useEffects'
import { KeycapScene } from './keycapScene'

export interface KeyboardStageProps {
  /** The board's DOM slot: the keyboard is drawn over its viewport rect. */
  slot: RefObject<HTMLElement | null>
  size: number
  tiles: readonly Tile[]
  over: boolean
  won: boolean
  /** The last move, to lean the board into it. */
  lastMove: { direction: Direction; moved: boolean; seq: number } | null
  onReady: () => void
  onError: () => void
}

const FONT = '"Unbounded"'

/**
 * Full-viewport WebGL canvas behind the UI with the keyboard board on it. It is aria-hidden and
 * ignores pointer input; the DOM board above it keeps the table, swipe and focus.
 */
export default function KeyboardStage({ slot, size, tiles, over, won, lastMove, onReady, onError }: KeyboardStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<KeycapScene | null>(null)
  const { reduced } = useEffects()
  const reducedRef = useRef(reduced)
  const tilesRef = useRef(tiles)
  const callbacks = useRef({ onReady, onError })
  useEffect(() => {
    callbacks.current = { onReady, onError }
  }, [onReady, onError])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let s: KeycapScene
    try {
      s = new KeycapScene(el, {
        size,
        reducedMotion: reducedRef.current,
        legendFont: FONT,
        slot: () => slot.current?.getBoundingClientRect() ?? null,
        onMerge: (x, y, value) => fxBus.emit({ type: 'merge', x, y, value }),
        onSpawn: (x, y) => fxBus.emit({ type: 'spawn', x, y }),
      })
    } catch {
      callbacks.current.onError()
      return
    }
    scene.current = s
    s.sync(tilesRef.current)
    s.start()
    callbacks.current.onReady()

    let alive = true
    document.fonts?.load(`700 100px ${FONT}`).then(() => alive && s.fontsLoaded(), () => {})

    const onResize = () => s.resize()
    const onMove = (e: PointerEvent) => s.setPointer(e.clientX, e.clientY, e.pointerType)
    const onLeave = () => s.clearPointer()
    const onLost = (e: Event) => {
      e.preventDefault()
      callbacks.current.onError()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    el.addEventListener('webglcontextlost', onLost)
    return () => {
      alive = false
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('webglcontextlost', onLost)
      s.dispose()
      scene.current = null
    }
  }, [slot, size])

  useEffect(() => {
    tilesRef.current = tiles
    scene.current?.sync(tiles)
  }, [tiles])

  useEffect(() => {
    reducedRef.current = reduced
    scene.current?.setReducedMotion(reduced)
  }, [reduced])

  useEffect(() => {
    scene.current?.setStatus(over, won)
  }, [over, won])

  useEffect(() => {
    if (lastMove) scene.current?.nudge(lastMove.direction, lastMove.moved)
  }, [lastMove])

  return createPortal(<canvas ref={canvas} aria-hidden="true" className="kc-stage" />, document.body)
}
