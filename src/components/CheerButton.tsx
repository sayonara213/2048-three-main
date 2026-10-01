import { useEffect, useRef, useState } from 'react'

/** Small "?" button pinned to the bottom-right on touch screens; tapping it shows a cheer. */
export function CheerButton() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="kc-cheer">
      {open && (
        <p id="cheer-popup" role="status" className="kc-cheer-popup" lang="ja">
          みうちゃん頑張って！
        </p>
      )}
      <button
        type="button"
        className="btn-ghost kc-cheer-btn"
        aria-label="Cheer"
        aria-expanded={open}
        aria-controls="cheer-popup"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
    </div>
  )
}
