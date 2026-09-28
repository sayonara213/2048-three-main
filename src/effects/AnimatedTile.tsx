import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { tileStyle } from './tileColors';
import { centerOf, fxBus } from './fxBus';
import { useEffects } from './useEffects';

export interface AnimatedTileProps {
  value: number;
  row: number;
  col: number;
  /** Cell edge length in px. */
  cell: number;
  /** Gap between cells in px. */
  gap: number;
  isNew?: boolean;
  merged?: boolean;
  /**
   * A tile that was just absorbed by a merge. Render it with its old id at the
   * merge destination so it visibly slides in underneath the merged tile.
   */
  ghost?: boolean;
}

// Keycap motion: slides 110ms ease-in-out, new tiles 0.6 -> 1 over 160ms,
// merges 1 -> 1.12 -> 1 over 180ms.
const SLIDE = { duration: 0.11, ease: 'easeInOut' } as const;
const SPAWN = { duration: 0.16, ease: 'easeOut', delay: 0.08 } as const;
const MERGE = { duration: 0.18, ease: 'easeInOut' as const, times: [0, 0.5, 1], delay: 0.06 };

/**
 * A single tile. Render it inside a `position: relative` layer whose origin is
 * the top-left cell, keyed by the tile's stable id so Framer Motion can slide
 * it between cells.
 */
export function AnimatedTile({ value, row, col, cell, gap, isNew, merged, ghost }: AnimatedTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced } = useEffects();
  const style = tileStyle(value);
  const x = col * (cell + gap);
  const y = row * (cell + gap);
  const digits = String(value).length;
  // tile-lg / tile-md / tile-sm, scaled from the 88px reference tile.
  const fontSize = cell * (digits <= 2 ? 0.45 : digits === 3 ? 0.36 : digits === 4 ? 0.28 : 0.22);

  // Fire a particle burst once the merged tile has slid into place.
  const prevValue = useRef(value);
  useEffect(() => {
    const grew = value > prevValue.current;
    prevValue.current = value;
    if (!(grew || merged) || ghost || reduced || !ref.current) return;
    const el = ref.current;
    const t = window.setTimeout(() => fxBus.emit({ type: 'merge', ...centerOf(el), value }), 90);
    return () => window.clearTimeout(t);
  }, [value, merged, ghost, reduced]);

  useEffect(() => {
    if (!isNew || reduced || !ref.current) return;
    const el = ref.current;
    const t = window.setTimeout(() => fxBus.emit({ type: 'spawn', ...centerOf(el) }), 120);
    return () => window.clearTimeout(t);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={isNew ? { x, y, scale: 0.6, opacity: 0 } : merged ? { x, y, opacity: 0 } : false}
      animate={{ x, y, scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: ghost ? 0 : 0.1 } }}
      transition={reduced ? { duration: 0 } : { ...SLIDE, scale: SPAWN, opacity: { duration: 0.12, delay: 0.08 } }}
      style={{ position: 'absolute', left: 0, top: 0, width: cell, height: cell, zIndex: ghost ? 0 : merged ? 2 : 1 }}
    >
      <motion.div
        key={value}
        initial={merged && !reduced ? { scale: 1 } : false}
        animate={merged && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={MERGE}
        className="kc-flat-cap"
        style={{
          borderRadius: Math.min(12, Math.round(cell * 0.14)),
          background: style.bg,
          color: style.fg,
          fontSize,
        }}
      >
        <span className={style.rainbow ? 'rainbow-text' : undefined}>{value}</span>
      </motion.div>
    </motion.div>
  );
}
