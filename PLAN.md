# Plan — Color Confusion

What: `Brief.md`. This file is how.

## Decisions (confirmed 2026-10-10)

- **2D only:** `ScreenShape` and `ScreenText` on the SDK's 720×1280 design canvas. No 3D objects.
  Shapes stand in for the brief's solids: blue circle (sphere), red triangle (pyramid),
  green rounded square (cube); L4 adds yellow star and purple hexagon.
- **Lives:** 3. A wrong answer costs a life; retry the same round with the wrong shape briefly
  blocked. At 0 lives, a game-over card (score, best) and "Play again" by palm hover.
- **Levels:** up every 5 correct answers. L2 at 5, L3 at 10, L4 at 15, then stays on L4.
- **No timer** at any level, and the target word stays visible.

## Rules (game state keeps these separate)

- `word` (what it says) and `ink` (its colour) are drawn independently from a seeded RNG
  (`?seed=N` for deterministic rounds); `word ≠ ink` always. **Correct answer = `ink`**, never
  `word`. `ink` is always a colour on screen; `word` can be any palette colour.
- One answer per selection: input is locked during feedback, and blocked shapes can't be picked.

## Levels

| | Shapes | Size (px) | Movement | Hover to confirm | Extras |
|---|---|---|---|---|---|
| L1 | 3 | 210 | still (slight bob) | 0.7 s | generous radius, rule hint |
| L2 | 3 | 185 | slow drift | 0.6 s | |
| L3 | 3 | 150 | faster drift | 0.5 s | tighter radius |
| L4 | 5 | 135 | drift | 0.5 s | misleading colour-word labels near shapes |

Scoring: correct = 10 × level + 2 × min(streak, 10). Best score in localStorage
(guarded; works without it).

## Input

- **Palm cursor:** palm centre (wrist + 4 knuckles) → `trackerPointToScreenPixels` → smoothed
  with the SDK's `smoothVector2`. Selection = nearest unblocked shape within its radius; a filling
  disc shows hover progress.
- **Dev only:** a **mouse cursor overrides the palm** while the mouse is moving, and `?level=N`
  starts at level N. Both are stripped from production builds. (A recorded clip was used as the
  camera during development, then removed: **the input is the webcam only.**)

## Rendering

Each animated element is a `ScreenShape`/`ScreenText` authored at the origin inside a `<group>`
that `useFrame` moves and scales (via `screenPixelsToScreenSpace`). No per-frame React
re-renders; React only re-renders on round / score / state changes.

## Production

- Title and share-preview metadata are in `index.html` (a platform file: re-apply after a template
  upgrade). An experience status signal is included. New `src/` files are in the manifest's
  `creator` list. `?seed=N` replays a round sequence (deterministic, also in production).
