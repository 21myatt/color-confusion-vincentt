// Every tunable. Positions and sizes are SDK design pixels: 720×1280 canvas,
// centre origin, +y up.

export type ColorId = "red" | "blue" | "green" | "yellow" | "purple";

export type ShapeKind = { kind: "circle" } | { kind: "polygon"; sides: number } | { kind: "roundedRectangle" } | { kind: "star"; sides: number };

export type PaletteEntry = { id: ColorId; word: string; hex: string; shape: ShapeKind };

/** Hues spread apart and lightness varied, so colours also differ in brightness. */
export const PALETTE: Record<ColorId, PaletteEntry> = {
  red: { id: "red", word: "RED", hex: "#ff3b3b", shape: { kind: "polygon", sides: 3 } },
  blue: { id: "blue", word: "BLUE", hex: "#2f6bff", shape: { kind: "circle" } },
  green: { id: "green", word: "GREEN", hex: "#22c55e", shape: { kind: "roundedRectangle" } },
  yellow: { id: "yellow", word: "YELLOW", hex: "#ffd60a", shape: { kind: "star", sides: 5 } },
  purple: { id: "purple", word: "PURPLE", hex: "#a855f7", shape: { kind: "polygon", sides: 6 } },
};

export const ALL_COLORS: ColorId[] = ["red", "blue", "green", "yellow", "purple"];

export type Level = {
  level: 1 | 2 | 3 | 4;
  colors: ColorId[];
  /** Shape size (px). */
  size: number;
  /** Selection radius as a multiple of the shape's radius. */
  reach: number;
  /** Hover time to confirm (s). */
  dwell: number;
  /** Drift amplitude (px) and speed (rad/s). */
  drift: number;
  driftSpeed: number;
  /** Misleading colour-word labels near shapes. */
  labels: boolean;
};

export const LEVELS: Level[] = [
  { level: 1, colors: ["red", "blue", "green"], size: 210, reach: 1.45, dwell: 0.7, drift: 0, driftSpeed: 0, labels: false },
  { level: 2, colors: ["red", "blue", "green"], size: 185, reach: 1.3, dwell: 0.6, drift: 45, driftSpeed: 0.55, labels: false },
  { level: 3, colors: ["red", "blue", "green"], size: 150, reach: 1.15, dwell: 0.5, drift: 75, driftSpeed: 0.9, labels: false },
  { level: 4, colors: ALL_COLORS, size: 135, reach: 1.15, dwell: 0.5, drift: 60, driftSpeed: 0.8, labels: true },
];

/** Correct answers needed per level-up. */
export const LEVEL_EVERY = 5;
export const START_LIVES = 3;

export const SCORING = { perLevel: 10, perStreak: 2, streakCap: 10 };

export const TIMING = {
  /** Pause on CORRECT! before the next round (s). */
  correct: 0.9,
  /** Pause on NOPE before play resumes (s). */
  wrong: 0.7,
  /** How long a wrongly picked shape stays blocked (s). */
  blocked: 1.4,
  /** Hover to press "Play again" (s). */
  restartDwell: 0.9,
};

/** Where shape centres may go, for a given shape size: inside the 720×1280 frame,
 *  below the HUD line under the target (y ≈ 300) and above the hint (y ≈ -575). */
export const playArea = (size: number) => ({
  minX: -360 + size / 2 + 34,
  maxX: 360 - size / 2 - 34,
  minY: -540 + size / 2 + 30,
  maxY: 290 - size / 2 - 20,
});

export const BEST_KEY = "color-confusion:best";
