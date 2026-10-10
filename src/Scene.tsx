// Scene.tsx — Color Confusion: a Stroop game played with your palm. Read the
// colour, not the word. See Brief.md (what) and PLAN.md (how).
import { lazy, Suspense } from "react";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { CursorRig } from "./game/cursor";
import { ExperienceStatus } from "./game/ExperienceStatus";
import { Game } from "./game/Game";

// Dev-only mouse stand-in for the palm, lazy and behind a constant esbuild folds
// to false in production. Two rules: `process.env.NODE_ENV`, not
// `import.meta.env.DEV` (vincentt-xr/v2-template#112); and write the check INSIDE
// the ternary — hoisted into a `const`, esbuild keeps the dead branch.
const DevMouse = process.env.NODE_ENV !== "production" ? lazy(() => import("./game/DevMouse")) : null;

export const Scene = () => (
  <>
    {/* 30 fps inference is plenty: the cursor is smoothed between samples. */}
    <HandTracker targetFps={30} />
    <CursorRig />
    <ExperienceStatus />

    <Game />

    {DevMouse ? (
      <Suspense fallback={null}>
        <DevMouse />
      </Suspense>
    ) : null}
  </>
);
