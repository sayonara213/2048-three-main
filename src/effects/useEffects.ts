import { createContext, useContext } from 'react';

export type EffectsLevel = 'full' | 'reduced';

export interface EffectsState {
  /** True when the OS asks for reduced motion or the player turned effects down. */
  reduced: boolean;
  level: EffectsLevel;
  setLevel: (l: EffectsLevel) => void;
}

export const EffectsCtx = createContext<EffectsState>({ reduced: false, level: 'full', setLevel: () => {} });

export function useEffects() {
  return useContext(EffectsCtx);
}
