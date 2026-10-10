// The palm cursor, in SDK design pixels (720×1280, centre origin, +y up).
// Written once per frame by <CursorRig /> (priority -1). In dev, a moving
// mouse overrides the palm (see DevMouse.tsx).
import { Vector2 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { XRModel, smoothVector2, trackerPointToScreenPixels } from "@vincentt-xr/sdk";
import { useXRContext, type XRModelNodeHandTracking } from "@vincentt-xr/sdk/low-level";

export const cursor = {
  /** Smoothed cursor position (px). */
  pos: new Vector2(0, -900),
  /** A palm (or the dev mouse) is driving the cursor. */
  active: false,
  source: "none" as "none" | "hand" | "mouse",
  /** A hand is in view (for the instructions). */
  handVisible: false,
};

/** Dev-only override, written by DevMouse. `at` = performance.now() of the last move. */
export const mouseOverride = { x: 0, y: 0, at: -Infinity };

const MOUSE_HOLD_MS = 1500;
const LOST_MS = 250;
const RATE = 18;

const target = new Vector2();
let lastSeen = -Infinity;

export const CursorRig = () => {
  const { session } = useXRContext();
  const { size } = useThree();

  useFrame((_s, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const now = performance.now();
    const node = session.getModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
    const c = node?.hands?.[0]?.coordinates ?? node?.coordinates;

    let source: typeof cursor.source = "none";
    if (now - mouseOverride.at < MOUSE_HOLD_MS) {
      target.set(mouseOverride.x, mouseOverride.y);
      source = "mouse";
    }
    if (c && c.length >= 21) {
      lastSeen = now;
      if (source === "none") {
        // Palm centre: wrist + four knuckles.
        const ids = [0, 5, 9, 13, 17];
        let x = 0;
        let y = 0;
        ids.forEach((i) => {
          x += c[i].x;
          y += c[i].y;
        });
        const p = trackerPointToScreenPixels({ point: { x: x / 5, y: y / 5, z: 0 }, viewportSize: size });
        target.set(p.x, p.y);
        source = "hand";
      }
    }
    cursor.handVisible = now - lastSeen < LOST_MS;
    if (source === "none" && cursor.handVisible) source = "hand"; // brief dropout: hold position

    if (source !== "none") {
      // Snap on (re)acquire; smooth otherwise.
      if (!cursor.active || cursor.source !== source) cursor.pos.copy(target);
      else smoothVector2(cursor.pos, target, RATE, dt, cursor.pos);
    }
    cursor.active = source !== "none";
    cursor.source = source;
  }, -1);

  return null;
};

if (process.env.NODE_ENV !== "production") {
  (window as unknown as { __cursor: typeof cursor }).__cursor = cursor;
}
