import { describe, expect, it } from "vitest";

import { LEVELS, TIMING } from "./config";
import { makeRng } from "./rng";
import { answer, makeRound, newGame, tick } from "./rounds";

describe("round generation", () => {
  it("never lets the word match its ink, and the answer is always the ink", () => {
    const rng = makeRng(7);
    for (const level of LEVELS) {
      for (let i = 0; i < 300; i += 1) {
        const r = makeRound(rng, level);
        expect(r.word).not.toBe(r.ink);
        expect(r.answer).toBe(r.ink);
        expect(r.objects.map((o) => o.color)).toContain(r.ink);
        expect(r.objects).toHaveLength(level.colors.length);
      }
    }
  });

  it("is deterministic for a seed", () => {
    const a = makeRound(makeRng(42), LEVELS[3]);
    const b = makeRound(makeRng(42), LEVELS[3]);
    expect(a).toEqual(b);
  });

  it("labels at L4 never name the shape's own colour", () => {
    const rng = makeRng(3);
    for (let i = 0; i < 200; i += 1) {
      makeRound(rng, LEVELS[3]).objects.forEach((o) => expect(o.label).not.toBe(o.color));
    }
  });
});

describe("game rules", () => {
  it("scores the ink, not the word", () => {
    const rng = makeRng(11);
    const g = newGame(rng, 0);
    const byWord = answer(g, g.round.word);
    // The word is never the answer; if it's on screen, picking it costs a life.
    if (g.round.objects.some((o) => o.color === g.round.word)) expect(byWord.lives).toBe(g.lives - 1);
    const byInk = answer(g, g.round.ink);
    expect(byInk.phase).toBe("correct");
    expect(byInk.score).toBeGreaterThan(0);
  });

  it("a wrong answer costs a life, keeps the round and blocks that shape", () => {
    const rng = makeRng(5);
    const g = newGame(rng, 0);
    const wrong = g.round.objects.find((o) => o.color !== g.round.answer)!.color;
    const after = answer(g, wrong);
    expect(after.lives).toBe(2);
    expect(after.phase).toBe("wrong");
    expect(answer(after, g.round.answer)).toBe(after); // locked during feedback
    const resumed = tick(after, TIMING.wrong, rng, TIMING);
    expect(resumed.phase).toBe("playing");
    expect(resumed.round).toBe(g.round);
    expect(answer(resumed, wrong)).toBe(resumed); // still blocked
  });

  it("ends the game at 0 lives", () => {
    const rng = makeRng(9);
    let g = newGame(rng, 0);
    for (let i = 0; i < 3; i += 1) {
      const wrong = g.round.objects.find((o) => o.color !== g.round.answer && !g.blocked[o.color])!.color;
      g = answer(g, wrong);
      if (g.phase === "wrong") g = tick(tick(g, TIMING.wrong, rng, TIMING), TIMING.blocked, rng, TIMING);
    }
    expect(g.phase).toBe("gameover");
  });

  it("levels up every 5 correct answers and stays on L4", () => {
    const rng = makeRng(1);
    let g = newGame(rng, 0);
    const seen: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      g = answer(g, g.round.answer);
      seen.push(g.level.level);
      g = tick(g, TIMING.correct, rng, TIMING);
    }
    expect(seen[3]).toBe(1);
    expect(seen[4]).toBe(2);
    expect(seen[9]).toBe(3);
    expect(seen[14]).toBe(4);
    expect(seen[24]).toBe(4);
  });
});
