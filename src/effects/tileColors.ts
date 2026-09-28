export interface TileStyle {
  /** Keycap fill. */
  bg: string;
  /** Legend ink. */
  fg: string;
  /** 0xRRGGBB for the key's backlight and Pixi particles. */
  glow: number;
  /** The legend is painted with the rainbow instead of `fg`. */
  rainbow?: boolean;
}

// Keycap palette. The first two values are plain white caps; from 8 up the caps
// walk the RGB stops, then go dark for 1024 and the rainbow-lit 2048. Every
// legend clears 4.5:1 on its cap.
export const LEGEND = '#141416'; // cap-legend
export const PAPER = '#f3f3f4'; // paper

export const RGB = [0xff5d6c, 0xffa94d, 0xffe45c, 0x5ee08a, 0x4fb8ff, 0x8c6cff, 0xff6ad5];

const STYLES: Record<number, TileStyle> = {
  2: { bg: '#eeeef0', fg: LEGEND, glow: 0xeeeef0 },
  4: { bg: '#bdbdc4', fg: LEGEND, glow: 0xd6d6dc },
  8: { bg: '#ff5d6c', fg: LEGEND, glow: 0xff5d6c },
  16: { bg: '#ffa94d', fg: LEGEND, glow: 0xffa94d },
  32: { bg: '#ffe45c', fg: LEGEND, glow: 0xffe45c },
  64: { bg: '#5ee08a', fg: LEGEND, glow: 0x5ee08a },
  128: { bg: '#4fb8ff', fg: LEGEND, glow: 0x4fb8ff },
  256: { bg: '#8c6cff', fg: LEGEND, glow: 0x8c6cff },
  512: { bg: '#ff6ad5', fg: LEGEND, glow: 0xff6ad5 },
  1024: { bg: '#2a2a2e', fg: PAPER, glow: 0xf3f3f4 },
  2048: { bg: '#141416', fg: PAPER, glow: 0xf3f3f4, rainbow: true },
};

export function tileStyle(value: number): TileStyle {
  // Values above 2048 keep the rainbow cap.
  return STYLES[value] ?? STYLES[2048]!;
}
