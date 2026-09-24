# 2048

The sliding-tile game, built with Vite, React, TypeScript and Tailwind CSS.

## Scripts

```bash
npm install
npm run dev        # start the dev server
npm test           # unit and component tests (Vitest)
npm run lint       # ESLint
npm run build      # typecheck and production build into dist/
```

## Layout

- `src/game/` holds the rules as pure functions (`newGame`, `move`, `slide`, `spawnTile`, `canMove`, `hasWon`). Randomness is injected so tests are deterministic, and tiles keep stable ids so the UI can animate them.
- `src/hooks/` wires the rules to React: game state, keyboard (arrows and WASD) and swipe input.
- `src/storage.ts` saves the game, best score, move count and play time to localStorage and validates it on load.
- `src/components/` is the board, scoreboard (score with a `+N` per move, best, timer, moves) and controls.
- `src/three/` draws the board as a 3D keyboard with Three.js. It loads lazily after the game is playable.

## Design

The look follows the **Keycap** design system from the keyboard portfolio: a graphite night, crisp white type, chunky keycaps, and a rainbow only where light would leak from an RGB keyboard. Tokens live as CSS variables at the top of `src/index.css`, and the tile palette shared by the 3D caps, the flat fallback and the Pixi particles is in `src/effects/tileColors.ts`.

The board is the portfolio's keyboard, rebuilt for 2048 (`src/three/keycapScene.ts`): a satin case and plate, sculpted keycaps whose legends are the tile values, studio lighting with soft shadows, a starfield, an RGB rim, and a backlight leaking around each cap. Tiles slide between switches, new ones drop in, merges flip the cap, the board leans into each move and tilts toward the pointer on desktop, and the caps grey out on game over. Without WebGL the board falls back to flat DOM keycaps.

## Accessibility

- Play with arrow keys, WASD, swipe, or the on-screen direction buttons.
- The board is exposed as a read-only table of cell values; the 3D canvas, the flat tile layer and the particle layer are decorative and hidden from assistive tech.
- A polite live region announces each move, merges, score and the new tile; an alert announces a win or game over, and focus moves to the next action.
- With reduced motion (from the OS or the Effects toggle) the keyboard stops tilting, floating and flipping, tiles move instantly, and particles stay off.
- Keycap legends and text meet WCAG AA contrast, and every tile shows its number, so colour is never the only cue.
