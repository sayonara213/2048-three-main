// PixiStage is deliberately not re-exported: import it lazily so PixiJS stays out of the main bundle.
export { EffectsProvider } from './EffectsContext';
export { useEffects } from './useEffects';
export { EffectsToggle } from './EffectsToggle';
export { AnimatedTile, type AnimatedTileProps } from './AnimatedTile';
export { ScorePopups, type ScoreGain } from './ScorePopups';
export { AnimatedNumber } from './AnimatedNumber';
export { fxBus, centerOf, type FxEvent } from './fxBus';
export { tileStyle } from './tileColors';
