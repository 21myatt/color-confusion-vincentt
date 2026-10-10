// The game, drawn with SDK screen primitives only (ScreenShape + ScreenText).
//
// Every animated element is authored at the origin inside a <group>; useFrame
// moves and scales the groups (design px → screen space), so animation never
// re-renders React. React re-renders only when the game state's `version`
// changes (new round, answer, life lost, restart).
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Group } from "three";
import { useFrame } from "@react-three/fiber";
import {
  ScreenShape,
  ScreenSpaceUI,
  ScreenText,
  screenPixelsToScreenSpace,
  type ScreenShapeSettingsInput,
} from "@vincentt-xr/sdk";
import { useScreenSpace } from "@vincentt-xr/sdk/low-level";

import { BEST_KEY, LEVEL_EVERY, PALETTE, START_LIVES, TIMING, type ColorId } from "./config";
import { cursor } from "./cursor";
import { makeRng, seedFromUrl } from "./rng";
import { answer, newGame, restart, tick, type GameState } from "./rounds";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INK_BG = "#0d1222";

const loadBest = () => {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (best: number) => {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private mode / blocked storage: best score lasts this session only.
  }
};

const shapeSettings = (color: ColorId, opts: { fill?: string; opacity?: number } = {}): ScreenShapeSettingsInput => {
  const { shape, hex } = PALETTE[color];
  return {
    kind: shape.kind,
    sides: "sides" in shape ? shape.sides : undefined,
    innerRadiusRatio: shape.kind === "star" ? 0.5 : undefined,
    cornerRadius: shape.kind === "roundedRectangle" ? 0.18 : undefined,
    fillColor: opts.fill ?? hex,
    fillOpacity: opts.opacity ?? 1,
    strokeWidth: 0,
  };
};

type Text = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color?: string;
  weight?: number;
  order?: number;
  spacing?: number;
};

const Label = ({ text, x, y, w, h, size, color = "#f4f7ff", weight = 700, order = 60, spacing = 0.02 }: Text) => (
  <ScreenText
    text={text}
    screenTransform={{
      position: { x, y },
      size: { width: w, height: h },
      renderOrder: order,
      overlay: true,
    }}
    textAlign="center"
    verticalAlign="center"
    fontFamily={FONT}
    fontWeight={weight}
    fontSize={size}
    resolution={150}
    letterSpacing={spacing}
    color={color}
    bgColor="transparent"
  />
);

/** Animation scratch per shape (not React state). */
type ShapeAnim = { pop: number; shake: number; hover: number };

const SPARKS = 12;

const Hearts = ({ lives }: { lives: number }) => (
  <>
    {Array.from({ length: START_LIVES }, (_, i) => (
      <ScreenShape
        key={i}
        transform={{ position: { x: 200 + i * 44, y: 590 }, size: { width: 30, height: 30 } }}
        settings={{
          kind: "circle",
          fillColor: "#ff6b6b",
          fillOpacity: i < lives ? 1 : 0,
          strokeColor: "#ff6b6b",
          strokeOpacity: 0.7,
          strokeWidth: 3,
        }}
        renderOrder={70}
      />
    ))}
  </>
);

const GameOver = ({ score, best, fillRef }: { score: number; best: number; fillRef: MutableRefObject<Group | null> }) => (
  <>
    <ScreenShape
      transform={{ position: { x: 0, y: 0 }, size: { width: 760, height: 1320 } }}
      settings={{ kind: "rectangle", fillColor: "#070b16", fillOpacity: 0.6, strokeWidth: 0 }}
      renderOrder={100}
    />
    <ScreenShape
      transform={{ position: { x: 0, y: 40 }, size: { width: 560, height: 560 } }}
      settings={{ kind: "roundedRectangle", cornerRadius: 0.1, fillColor: INK_BG, fillOpacity: 0.96, strokeColor: "#ffffff", strokeOpacity: 0.15, strokeWidth: 2 }}
      renderOrder={101}
    />
    <Label text="GAME OVER" x={0} y={240} w={520} h={90} size={64} weight={900} order={102} />
    <Label text={`SCORE ${score}`} x={0} y={140} w={520} h={60} size={40} weight={700} order={102} />
    <Label text={`BEST ${best}`} x={0} y={80} w={520} h={50} size={28} weight={600} color="rgba(244,247,255,0.7)" order={102} />
    <ScreenShape
      transform={{ position: { x: 0, y: -170 }, size: { width: 300, height: 110 } }}
      settings={{ kind: "roundedRectangle", cornerRadius: 0.4, fillColor: "#ffffff", fillOpacity: 0.12, strokeColor: "#ffffff", strokeOpacity: 0.8, strokeWidth: 3 }}
      renderOrder={102}
    />
    <group ref={fillRef} visible={false}>
      <ScreenShape
        transform={{ position: { x: 0, y: 0 }, size: { width: 300, height: 110 } }}
        settings={{ kind: "roundedRectangle", cornerRadius: 0.4, fillColor: "#4ade80", fillOpacity: 0.45, strokeWidth: 0 }}
        renderOrder={103}
      />
    </group>
    <Label text="PLAY AGAIN" x={0} y={-170} w={300} h={110} size={34} weight={800} spacing={0.08} order={104} />
    <Label text="Hold your palm on the button" x={0} y={-90} w={520} h={40} size={22} weight={500} color="rgba(244,247,255,0.7)" order={102} />
  </>
);

const GameInner = () => {
  const dims = useScreenSpace();
  const rng = useMemo(() => makeRng(seedFromUrl(window.location.search)), []);
  // Dev-only `?level=N` starts at level N (for testing later levels).
  const startCorrect =
    process.env.NODE_ENV !== "production"
      ? Math.max(0, (Number(new URLSearchParams(window.location.search).get("level")) || 1) - 1) * LEVEL_EVERY
      : 0;
  const state = useRef<GameState>(newGame(rng, loadBest(), startCorrect));
  const [, rerender] = useState(0);

  // Group refs.
  const shapeGroups = useRef<Partial<Record<ColorId, Group | null>>>({});
  const anims = useRef<Partial<Record<ColorId, ShapeAnim>>>({});
  const ring = useRef<Group>(null);
  const fill = useRef<Group>(null);
  const cursorGroup = useRef<Group>(null);
  const target = useRef<Group>(null);
  const feedbackOk = useRef<Group>(null);
  const feedbackNo = useRef<Group>(null);
  const levelBanner = useRef<Group>(null);
  const sparks = useRef<(Group | null)[]>([]);
  const restartFill = useRef<Group>(null);

  const animFor = (c: ColorId): ShapeAnim => {
    let a = anims.current[c];
    if (!a) {
      a = { pop: 1, shake: 1, hover: 0 };
      anims.current[c] = a;
    }
    return a;
  };

  const ui = useRef({
    hovered: null as ColorId | null,
    dwell: 0,
    roundAge: 0,
    restartDwell: 0,
    sparkT: 1,
    sparkAt: { x: 0, y: 0 },
    sparkColor: "red" as ColorId,
    sparkDirs: Array.from({ length: SPARKS }, (_, i) => {
      const a = (i / SPARKS) * Math.PI * 2 + (i % 2) * 0.2;
      return { x: Math.cos(a), y: Math.sin(a), speed: 120 + (i % 3) * 45 };
    }),
    positions: {} as Partial<Record<ColorId, { x: number; y: number }>>,
  });

  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __game: unknown }).__game = { state, ui };
  }

  // Design px → ScreenSpaceUI local space.
  const zero = screenPixelsToScreenSpace({ point: { x: 0, y: 0 }, parentSize: dims });
  const unit = screenPixelsToScreenSpace({ point: { x: 1000, y: 1000 }, parentSize: dims });
  const sx = (unit.x - zero.x) / 1000;
  const sy = (unit.y - zero.y) / 1000;
  const place = (g: Group | null | undefined, x: number, y: number) => {
    g?.position.set(zero.x + x * sx, zero.y + y * sy, 0);
  };

  useFrame((frameState, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const t = frameState.clock.elapsedTime;
    const u = ui.current;
    let s = tick(state.current, dt, rng, TIMING);
    const { level, round } = s;
    u.roundAge += dt;

    // ── Live shape positions (drift) ──
    round.objects.forEach((o) => {
      const amp = level.drift;
      const bob = 6;
      const w = level.driftSpeed;
      u.positions[o.color] = {
        x: o.x + Math.sin(t * w + o.phase) * amp,
        y: o.y + Math.cos(t * w * 0.8 + o.phase * 1.3) * amp * 0.7 + Math.sin(t * 1.4 + o.phase) * bob,
      };
    });

    // ── Hover → dwell → answer ──
    let hovered: ColorId | null = null;
    if (s.phase === "playing" && cursor.active) {
      let best = Infinity;
      for (const o of round.objects) {
        const p = u.positions[o.color];
        if (s.blocked[o.color] || !p) continue;
        const d = Math.hypot(cursor.pos.x - p.x, cursor.pos.y - p.y);
        if (d < (level.size / 2) * level.reach && d < best) {
          best = d;
          hovered = o.color;
        }
      }
    }
    if (hovered !== u.hovered) {
      u.hovered = hovered;
      u.dwell = 0;
    } else if (hovered) {
      u.dwell += dt;
    }
    if (hovered && u.dwell >= level.dwell) {
      const picked: ColorId = hovered;
      const before = s;
      s = answer(s, picked);
      u.dwell = 0;
      u.hovered = null;
      const a = animFor(picked);
      if (s.phase === "correct") {
        a.pop = 0;
        u.sparkT = 0;
        const at = u.positions[picked];
        if (at) u.sparkAt = { x: at.x, y: at.y };
        u.sparkColor = picked;
        if (s.best > before.best) saveBest(s.best);
      } else if (s !== before) {
        a.shake = 0;
      }
    }

    // ── Game over: hover "Play again" ──
    if (s.phase === "gameover" && s.phaseTime > 0.8 && cursor.active) {
      const over = Math.abs(cursor.pos.x) < 170 && Math.abs(cursor.pos.y - -170) < 70;
      u.restartDwell = over ? u.restartDwell + dt : 0;
      if (u.restartDwell >= TIMING.restartDwell) {
        u.restartDwell = 0;
        s = restart(s, rng);
      }
    } else if (s.phase !== "gameover") {
      u.restartDwell = 0;
    }

    if (s.round !== state.current.round) u.roundAge = 0;
    const changed = s.version !== state.current.version;
    state.current = s;
    if (changed) rerender(s.version);

    // ── Animate shapes ──
    round.objects.forEach((o) => {
      const a = animFor(o.color);
      a.pop = Math.min(1, a.pop + dt / 0.55);
      a.shake = Math.min(1, a.shake + dt / 0.45);
      a.hover += ((u.hovered === o.color ? 1 : 0) - a.hover) * Math.min(1, dt * 12);
      const p = u.positions[o.color]!;
      const shakeX = a.shake < 1 ? Math.sin(a.shake * 46) * 16 * (1 - a.shake) : 0;
      const g = shapeGroups.current[o.color];
      place(g, p.x + shakeX, p.y);
      // Entrance: grow in at the start of a round.
      const enter = Math.min(1, u.roundAge / 0.3);
      const pop = a.pop < 1 ? 1 + 0.35 * Math.sin(Math.PI * a.pop) * (1 - a.pop * 0.5) : 1;
      g?.scale.setScalar((0.6 + 0.4 * (1 - (1 - enter) ** 3)) * pop * (1 + 0.07 * a.hover));
    });

    // ── Selection ring + dwell fill ──
    const hp = u.hovered ? u.positions[u.hovered] : null;
    if (ring.current && fill.current) {
      ring.current.visible = !!hp;
      fill.current.visible = !!hp;
      if (hp) {
        place(ring.current, hp.x, hp.y);
        place(fill.current, hp.x, hp.y);
        ring.current.scale.setScalar((level.size * 1.32) / 100);
        fill.current.scale.setScalar(((level.size * 1.32) / 100) * Math.min(1, u.dwell / level.dwell));
      }
    }

    // ── Cursor ──
    if (cursorGroup.current) {
      cursorGroup.current.visible = cursor.active;
      place(cursorGroup.current, cursor.pos.x, cursor.pos.y);
    }

    // ── Target entrance ──
    if (target.current) {
      place(target.current, 0, 450);
      target.current.scale.setScalar(0.85 + 0.15 * Math.min(1, u.roundAge / 0.25));
    }

    // ── Feedback text ──
    const popIn = (x: number) => (x < 0.25 ? 0.5 + 2.6 * x : 1.15 - 0.15 * Math.min(1, (x - 0.25) / 0.2));
    if (feedbackOk.current) {
      feedbackOk.current.visible = s.phase === "correct";
      feedbackOk.current.scale.setScalar(popIn(s.phaseTime));
      place(feedbackOk.current, 0, 240);
    }
    if (feedbackNo.current) {
      feedbackNo.current.visible = s.phase === "wrong";
      feedbackNo.current.scale.setScalar(popIn(s.phaseTime));
      place(feedbackNo.current, s.phaseTime < 0.4 ? Math.sin(s.phaseTime * 50) * 10 * (1 - s.phaseTime / 0.4) : 0, 330);
    }
    if (levelBanner.current) levelBanner.current.visible = s.phase === "correct" && s.levelUp;

    // ── Sparkles ──
    u.sparkT = Math.min(1, u.sparkT + dt / 0.7);
    sparks.current.forEach((g, i) => {
      if (!g) return;
      g.visible = u.sparkT < 1;
      if (!g.visible) return;
      const d = u.sparkDirs[i];
      const e = 1 - (1 - u.sparkT) ** 3;
      place(g, u.sparkAt.x + d.x * d.speed * e, u.sparkAt.y + d.y * d.speed * e);
      g.scale.setScalar(Math.max(0.001, 1 - u.sparkT));
      g.rotation.z = u.sparkT * 3;
    });

    // ── Restart progress ──
    if (restartFill.current) {
      const pr = Math.min(1, u.restartDwell / TIMING.restartDwell);
      restartFill.current.visible = pr > 0;
      restartFill.current.scale.set(Math.max(0.001, pr), 1, 1);
      place(restartFill.current, -150 * (1 - pr), -170);
    }
  });

  const s = state.current;
  const { round, level } = s;
  const showHint = s.phase !== "gameover" && (s.correct < 2 || !cursor.handVisible);

  return (
    <>
      {/* Backdrop: dims the camera into a clean stage. */}
      <ScreenShape
        transform={{ position: { x: 0, y: 0 }, size: { width: 760, height: 1320 } }}
        settings={{ kind: "rectangle", fillColor: "#070b16", fillOpacity: 0.55, strokeWidth: 0 }}
        renderOrder={1}
      />

      {/* HUD */}
      <Label text={`SCORE ${s.score}`} x={-200} y={590} w={300} h={56} size={30} order={70} />
      <Hearts lives={s.lives} />
      <Label
        text={`LEVEL ${level.level}   ·   STREAK ${s.streak}   ·   BEST ${s.best}`}
        x={0}
        y={322}
        w={640}
        h={44}
        size={22}
        weight={600}
        color="rgba(244,247,255,0.75)"
        order={70}
      />

      {/* Target */}
      <group ref={target}>
        <ScreenShape
          transform={{ position: { x: 0, y: 0 }, size: { width: 620, height: 190 } }}
          settings={{ kind: "roundedRectangle", cornerRadius: 0.16, fillColor: INK_BG, fillOpacity: 0.86, strokeColor: "#ffffff", strokeOpacity: 0.12, strokeWidth: 2 }}
          renderOrder={40}
        />
        <Label text="TARGET" x={0} y={58} w={600} h={40} size={24} weight={700} spacing={0.3} color="rgba(244,247,255,0.7)" order={50} />
        <Label
          key={`${round.word}-${round.ink}-${s.version}`}
          text={PALETTE[round.word].word}
          x={0}
          y={-18}
          w={600}
          h={120}
          size={104}
          weight={900}
          spacing={0.04}
          color={PALETTE[round.ink].hex}
          order={50}
        />
      </group>

      {/* Shapes */}
      {round.objects.map((o) => (
        <group
          key={`${o.color}-${level.level}`}
          ref={(g) => {
            shapeGroups.current[o.color] = g;
          }}
        >
          {/* Soft drop shadow */}
          <ScreenShape
            transform={{ position: { x: 8, y: -12 }, size: { width: level.size, height: level.size } }}
            settings={shapeSettings(o.color, { fill: "#000000", opacity: 0.28 })}
            renderOrder={10}
          />
          <ScreenShape
            transform={{ position: { x: 0, y: 0 }, size: { width: level.size, height: level.size } }}
            settings={shapeSettings(o.color, { opacity: s.blocked[o.color] ? 0.3 : 1 })}
            renderOrder={11}
          />
          {o.label ? (
            <Label text={PALETTE[o.label].word} x={0} y={-level.size * 0.5 - 30} w={240} h={40} size={24} weight={800} order={12} />
          ) : null}
        </group>
      ))}

      {/* Selection ring + dwell fill */}
      <group ref={ring} visible={false}>
        <ScreenShape
          transform={{ position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }}
          settings={{ kind: "circle", fillOpacity: 0, strokeColor: "#ffffff", strokeOpacity: 0.95, strokeWidth: 4 }}
          renderOrder={20}
        />
      </group>
      <group ref={fill} visible={false}>
        <ScreenShape
          transform={{ position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }}
          settings={{ kind: "circle", fillColor: "#ffffff", fillOpacity: 0.22, strokeWidth: 0 }}
          renderOrder={19}
        />
      </group>

      {/* Sparkles */}
      {Array.from({ length: SPARKS }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(g) => {
            sparks.current[i] = g;
          }}
        >
          <ScreenShape
            transform={{ position: { x: 0, y: 0 }, size: { width: 30, height: 30 } }}
            settings={{ kind: "star", sides: 4, innerRadiusRatio: 0.35, fillColor: i % 3 === 0 ? "#ffffff" : PALETTE[ui.current.sparkColor].hex, strokeWidth: 0 }}
            renderOrder={30}
          />
        </group>
      ))}

      {/* Feedback */}
      <group ref={feedbackOk} visible={false}>
        <Label text="CORRECT!" x={0} y={0} w={600} h={110} size={84} weight={900} color="#4ade80" order={80} />
      </group>
      <group ref={levelBanner} visible={false}>
        <Label text={`LEVEL ${level.level}`} x={0} y={170} w={400} h={60} size={40} weight={800} spacing={0.2} order={80} />
      </group>
      <group ref={feedbackNo} visible={false}>
        <Label text="NOPE" x={0} y={0} w={500} h={110} size={88} weight={900} color="#ff6b6b" order={80} />
      </group>

      {/* Hint */}
      {showHint ? (
        <Label
          text={cursor.handVisible ? "Read the COLOR, not the word — hover your palm on that shape" : "Raise your open palm"}
          x={0}
          y={-578}
          w={690}
          h={60}
          size={27}
          weight={600}
          color="rgba(244,247,255,0.85)"
          order={70}
        />
      ) : null}

      {/* Palm cursor */}
      <group ref={cursorGroup} visible={false}>
        <ScreenShape
          transform={{ position: { x: 0, y: 0 }, size: { width: 46, height: 46 } }}
          settings={{ kind: "circle", fillOpacity: 0, strokeColor: "#ffffff", strokeOpacity: 0.9, strokeWidth: 3 }}
          renderOrder={90}
        />
        <ScreenShape
          transform={{ position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }}
          settings={{ kind: "circle", fillColor: "#ffffff", strokeWidth: 0 }}
          renderOrder={91}
        />
      </group>

      {s.phase === "gameover" ? <GameOver score={s.score} best={s.best} fillRef={restartFill} /> : null}
    </>
  );
};

export const Game = () => (
  <ScreenSpaceUI>
    <GameInner />
  </ScreenSpaceUI>
);
