import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeDuration, formatDuration, useTimer } from './useTimer'

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [9_999, '0:09'],
    [65_000, '1:05'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
  ])('%i ms -> %s', (ms, text) => expect(formatDuration(ms)).toBe(text))

  it('spells durations out for screen readers', () => {
    expect(describeDuration(1_000)).toBe('1 second')
    expect(describeDuration(125_000)).toBe('2 minutes 5 seconds')
  })
})

describe('useTimer', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('counts only while running, resumes from where it paused, and resets', () => {
    const { result, rerender } = renderHook(({ running }) => useTimer(running, 2_000), {
      initialProps: { running: false },
    })
    act(() => void vi.advanceTimersByTime(5_000))
    expect(result.current.elapsed).toBe(2_000)

    rerender({ running: true })
    act(() => void vi.advanceTimersByTime(3_000))
    expect(result.current.elapsed).toBe(5_000)

    rerender({ running: false })
    act(() => void vi.advanceTimersByTime(10_000))
    expect(result.current.elapsed).toBe(5_000)

    rerender({ running: true })
    act(() => void vi.advanceTimersByTime(1_000))
    expect(result.current.elapsed).toBe(6_000)

    act(() => result.current.reset())
    act(() => void vi.advanceTimersByTime(2_000))
    expect(result.current.elapsed).toBe(2_000)
  })
})
