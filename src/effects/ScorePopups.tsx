import { AnimatePresence, motion } from 'framer-motion';
import { useEffects } from './useEffects';

export interface ScoreGain {
  /** Unique per move, e.g. the move counter. */
  id: number | string;
  amount: number;
}

/**
 * Floating "+N" labels for the points gained on each move. Purely visual:
 * the game's live region should announce the score for screen readers.
 * Place inside a `position: relative` wrapper around the score counter.
 */
export function ScorePopups({ gains }: { gains: ScoreGain[] }) {
  const { reduced } = useEffects();
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <AnimatePresence>
        {gains
          .filter((g) => g.amount > 0)
          .map((g) => {
            const big = g.amount >= 64;
            return (
              <motion.span
                key={g.id}
                className={big ? 'rainbow-text' : undefined}
                initial={{ opacity: 0, y: 0, scale: reduced ? 1 : 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: reduced ? -18 : -34, scale: reduced ? 1 : big ? 1.35 : 1 }}
                transition={{ duration: reduced ? 1.2 : 0.9, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  translateX: '-50%',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: big ? '1.25rem' : '1rem',
                  color: big ? undefined : 'var(--paper)',
                  whiteSpace: 'nowrap',
                }}
              >
                +{g.amount}
              </motion.span>
            );
          })}
      </AnimatePresence>
    </div>
  );
}
