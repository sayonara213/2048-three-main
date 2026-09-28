/**
 * Tiny event bus that lets game code request visual effects without
 * knowing anything about PixiJS. Positions are viewport (client) pixels.
 */
export type FxEvent =
  | { type: 'merge'; x: number; y: number; value: number }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'win'; x: number; y: number }
  | { type: 'gameOver' }
  | { type: 'reset' };

type Listener = (e: FxEvent) => void;

const listeners = new Set<Listener>();

export const fxBus = {
  emit(e: FxEvent) {
    listeners.forEach((l) => l(e));
  },
  on(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Viewport centre of an element, handy for `merge` / `spawn` events. */
export function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
