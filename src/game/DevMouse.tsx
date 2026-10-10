// Dev-only (lazy-loaded by Scene.tsx): the mouse stands in for the palm while it
// moves, because the preview clip's palm can't reach the shapes. Never shipped.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { clientToScreenPixels } from "@vincentt-xr/sdk";

import { mouseOverride } from "./cursor";

const DevMouse = () => {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const p = clientToScreenPixels({
        point: { x: e.clientX, y: e.clientY },
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      });
      mouseOverride.x = p.x;
      mouseOverride.y = p.y;
      mouseOverride.at = performance.now();
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [gl]);
  return null;
};

export default DevMouse;
