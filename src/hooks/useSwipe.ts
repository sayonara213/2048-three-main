import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Direction } from '../game'

/** Minimum travel in px before a drag counts as a swipe. */
const THRESHOLD = 24

/**
 * Pointer handlers that turn a swipe (touch, pen or mouse drag) into a
 * direction. Pair with `touch-action: none` on the element so the page does
 * not scroll mid-swipe.
 */
export function useSwipe(onSwipe: (direction: Direction) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)

  return {
    onPointerDown(event: PointerEvent) {
      if (!event.isPrimary) return
      start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    },
    onPointerUp(event: PointerEvent) {
      const s = start.current
      start.current = null
      if (!s || s.id !== event.pointerId) return
      const dx = event.clientX - s.x
      const dy = event.clientY - s.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return
      if (Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left')
      else onSwipe(dy > 0 ? 'down' : 'up')
    },
    onPointerCancel() {
      start.current = null
    },
  }
}
