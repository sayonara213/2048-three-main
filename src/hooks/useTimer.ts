import { useCallback, useEffect, useRef, useState } from 'react'

const TICK_MS = 250

/**
 * Elapsed play time in ms. Counts only while `running` and the tab is visible.
 * `reset` sets it back to zero, e.g. for a new game.
 */
export function useTimer(running: boolean, initialMs = 0) {
  const [elapsed, setElapsed] = useState(initialMs)
  /** Time banked before the current run. */
  const banked = useRef(initialMs)
  /** performance.now() when the current run began, or null while paused. */
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    const read = () => banked.current + (startedAt.current === null ? 0 : performance.now() - startedAt.current)
    // Whole seconds only, so the app re-renders once a second rather than every tick.
    const tick = () => setElapsed(Math.floor(read() / 1000) * 1000)
    const pause = () => {
      banked.current = read()
      startedAt.current = null
    }
    const onVisibility = () => {
      if (document.hidden) pause()
      else if (startedAt.current === null) startedAt.current = performance.now()
      tick()
    }

    startedAt.current = document.hidden ? null : performance.now()
    const id = window.setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      pause()
      tick()
    }
  }, [running])

  const reset = useCallback(() => {
    banked.current = 0
    if (startedAt.current !== null) startedAt.current = performance.now()
    setElapsed(0)
  }, [])

  return { elapsed, reset }
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Spoken form, e.g. "2 minutes 5 seconds". */
export function describeDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const parts = [h && part(h, 'hour'), m && part(m, 'minute'), part(s, 'second')].filter(Boolean)
  return parts.join(' ')
}
