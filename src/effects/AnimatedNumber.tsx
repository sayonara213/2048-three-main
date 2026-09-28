import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffects } from './useEffects';

const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

/** Counts up to `value`. Screen readers only ever see the final number. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const { reduced } = useEffects();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.45, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return (
    <span className={className}>
      <motion.span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {text}
      </motion.span>
      <span style={srOnly}>{value.toLocaleString()}</span>
    </span>
  );
}
