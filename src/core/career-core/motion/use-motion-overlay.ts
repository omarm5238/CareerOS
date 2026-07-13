"use client";

import { useEffect, useRef } from "react";

import { useCareerCoreMotionStore } from "./context";

type MotionOverlayOptions = {
  parallaxX: number;
  parallaxY: number;
  depth?: number;
};

export function useCareerCoreMotionOverlay({
  parallaxX,
  parallaxY,
  depth = 1,
}: MotionOverlayOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const store = useCareerCoreMotionStore();

  useEffect(() => {
    if (!store) return;

    let frame = 0;

    function tick() {
      const element = ref.current;
      const motionStore = store;
      if (element && motionStore) {
        const { pointerX, pointerY, pulsePhase, reducedMotion } = motionStore.snapshot;
        const motionScale = reducedMotion ? 0 : 1;
        const breathe = reducedMotion ? 1 : 1 + Math.sin(pulsePhase) * 0.012 * depth;
        const translateX = pointerX * parallaxX * motionScale;
        const translateY = pointerY * parallaxY * motionScale;
        const glow = 0.08 + Math.max(0, Math.sin(pulsePhase)) * 0.06;

        element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${breathe})`;
        element.style.setProperty("--module-pulse-glow", String(glow));
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [depth, parallaxX, parallaxY, store]);

  return ref;
}
