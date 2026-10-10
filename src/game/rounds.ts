// Round generation and the game state machine — pure, no rendering, so it is
// unit-tested (rounds.test.ts). The word, its rendered colour and the correct
// answer are separate fields; the answer comes only from the rendered colour.
import { ALL_COLORS, LEVEL_EVERY, LEVELS, playArea, SCORING, START_LIVES, type ColorId, type Level } from "./config";
import { pick, shuffle, type Rng } from "./rng";

export type GameObject = {
  color: ColorId;
  /** Resting centre (px). */
  x: number;
  y: number;
  /** L4: a misleading colour word shown near the shape (never its own colour). */
  label: ColorId | null;
  /** Drift phase. */
  phase: number;
};

export type Round = {
  /** What the target text says. */
  word: ColorId;
  /** The colour it is rendered in. */
  ink: ColorId;
  /** The correct answer: always the ink. Kept explicit so nothing reads `word` by mistake. */
  answer: ColorId;
  objects: GameObject[];
};

export const levelFor = (correct: number): Level => LEVELS[Math.min(LEVELS.length - 1, Math.floor(correct / LEVEL_EVERY))];

export const makeRound = (rng: Rng, level: Level, previousInk: ColorId | null = null): Round => {
  // Ink: a colour on screen; avoid repeating the last answer when there's a choice.
  const inkChoices = level.colors.filter((c) => c !== previousInk);
  const ink = pick(rng, inkChoices.length > 0 ? inkChoices : level.colors);
  // Word: any palette colour except the ink — the conflict is the whole game.
  const word = pick(rng, ALL_COLORS.filter((c) => c !== ink));

  const minGap = level.size * 1.55 + level.drift * 2;
  // Drift stays inside the frame too.
  const raw = playArea(level.size);
  const PLAY_AREA = {
    minX: raw.minX + level.drift,
    maxX: raw.maxX - level.drift,
    minY: raw.minY + level.drift * 0.7,
    maxY: raw.maxY - level.drift * 0.7,
  };
  const placed: { x: number; y: number }[] = [];
  const colors = shuffle(rng, level.colors);
  colors.forEach((_, i) => {
    let best = { x: 0, y: 0 };
    let bestGap = -1;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const p = {
        x: PLAY_AREA.minX + rng() * (PLAY_AREA.maxX - PLAY_AREA.minX),
        y: PLAY_AREA.minY + rng() * (PLAY_AREA.maxY - PLAY_AREA.minY),
      };
      const gap = placed.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), Infinity);
      if (gap > bestGap) {
        best = p;
        bestGap = gap;
      }
      if (gap >= minGap) break;
    }
    placed[i] = best;
  });

  const objects: GameObject[] = colors.map((color, i) => ({
    color,
    x: placed[i].x,
    y: placed[i].y,
    label: level.labels ? pick(rng, ALL_COLORS.filter((c) => c !== color)) : null,
    phase: rng() * Math.PI * 2,
  }));

  return { word, ink, answer: ink, objects };
};

export type Phase = "playing" | "correct" | "wrong" | "gameover";

export type GameState = {
  phase: Phase;
  /** Seconds in the current phase. */
  phaseTime: number;
  score: number;
  best: number;
  lives: number;
  streak: number;
  correct: number;
  level: Level;
  round: Round;
  /** Colour picked in the last answer (for feedback animation). */
  picked: ColorId | null;
  /** Colours blocked after a wrong pick → seconds remaining. */
  blocked: Partial<Record<ColorId, number>>;
  /** Bumped on every change React needs to re-render for. */
  version: number;
  /** True right after a level-up (for the banner). */
  levelUp: boolean;
};

export const newGame = (rng: Rng, best: number, startCorrect = 0): GameState => {
  const level = levelFor(startCorrect);
  return {
    phase: "playing",
    phaseTime: 0,
    score: 0,
    best,
    lives: START_LIVES,
    streak: 0,
    correct: startCorrect,
    level,
    round: makeRound(rng, level),
    picked: null,
    blocked: {},
    version: 0,
    levelUp: false,
  };
};

/** Apply one answer. Ignored unless the game is accepting answers and the colour isn't blocked. */
export const answer = (s: GameState, color: ColorId): GameState => {
  if (s.phase !== "playing" || s.blocked[color] || !s.round.objects.some((o) => o.color === color)) return s;
  if (color === s.round.answer) {
    const streak = s.streak + 1;
    const correct = s.correct + 1;
    const score = s.score + SCORING.perLevel * s.level.level + SCORING.perStreak * Math.min(streak - 1, SCORING.streakCap);
    const level = levelFor(correct);
    return {
      ...s,
      phase: "correct",
      phaseTime: 0,
      streak,
      correct,
      score,
      best: Math.max(s.best, score),
      levelUp: level.level !== s.level.level,
      level,
      picked: color,
      version: s.version + 1,
    };
  }
  const lives = s.lives - 1;
  return {
    ...s,
    phase: lives <= 0 ? "gameover" : "wrong",
    phaseTime: 0,
    lives,
    streak: 0,
    picked: color,
    blocked: { ...s.blocked, [color]: Number.POSITIVE_INFINITY },
    levelUp: false,
    version: s.version + 1,
  };
};

/** Advance time: end feedback phases, expire blocks. */
export const tick = (s: GameState, dt: number, rng: Rng, timing: { correct: number; wrong: number; blocked: number }): GameState => {
  const phaseTime = s.phaseTime + dt;
  if (s.phase === "correct" && phaseTime >= timing.correct) {
    return {
      ...s,
      phase: "playing",
      phaseTime: 0,
      round: makeRound(rng, s.level, s.round.ink),
      picked: null,
      blocked: {},
      levelUp: false,
      version: s.version + 1,
    };
  }
  if (s.phase === "wrong" && phaseTime >= timing.wrong) {
    // Same round continues; the wrong shape stays blocked a little longer.
    const blocked: GameState["blocked"] = {};
    (Object.keys(s.blocked) as ColorId[]).forEach((c) => {
      blocked[c] = timing.blocked - timing.wrong;
    });
    return { ...s, phase: "playing", phaseTime: 0, picked: null, blocked, version: s.version + 1 };
  }
  // Count down blocks while playing.
  let changed = false;
  const blocked: GameState["blocked"] = {};
  (Object.keys(s.blocked) as ColorId[]).forEach((c) => {
    const left = (s.blocked[c] ?? 0) - (s.phase === "playing" ? dt : 0);
    if (left > 0) blocked[c] = left;
    else changed = true;
  });
  return changed ? { ...s, phaseTime, blocked, version: s.version + 1 } : { ...s, phaseTime, blocked: s.blocked };
};

export const restart = (s: GameState, rng: Rng): GameState => ({ ...newGame(rng, s.best), version: s.version + 1 });
