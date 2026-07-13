"use client";

import { useEffect, useRef, useState } from "react";

import { CareerCoreMotionProvider } from "../motion/context";
import { createCareerCoreMotionStore } from "../motion/shared";
import { CareerCoreScene } from "../scene";
import type { CareerCoreEngineState, CareerCoreProps } from "../types";

const defaultEngineState: Omit<
  CareerCoreEngineState,
  "mode" | "density" | "accent" | "highlightedModule" | "reducedMotion"
> = {
  interactive: false,
  pulse: false,
  animated: true,
  pointer: {
    x: 0,
    y: 0,
    active: false,
  },
};

export function CareerCoreEngine({
  mode = "idle",
  interactive = false,
  pulse = false,
  animated = true,
  density = "medium",
  accent = "indigo",
  className = "",
  highlightedModule = null,
  children,
}: CareerCoreProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionStoreRef = useRef(createCareerCoreMotionStore());
  const motionStore = motionStoreRef.current;

  useEffect(() => {
    motionStore.snapshot.reducedMotion = prefersReducedMotion;
  }, [motionStore, prefersReducedMotion]);

  useEffect(() => {
    motionStore.snapshot.hoveredModule = highlightedModule;
  }, [highlightedModule, motionStore]);

  const engineState: CareerCoreEngineState = {
    ...defaultEngineState,
    mode,
    density,
    accent,
    interactive,
    pulse: pulse && !prefersReducedMotion,
    animated: animated && !prefersReducedMotion,
    highlightedModule,
    reducedMotion: prefersReducedMotion,
  };

  return (
    <CareerCoreMotionProvider store={motionStore}>
      <div
        ref={(element) => {
          motionStore.containerRef.current = element;
        }}
        className={`${interactive ? "" : "pointer-events-none"} ${className || "relative h-full w-full"}`}
      >
        <div
          data-career-core-mode={mode}
          data-career-core-accent={accent}
          style={{ position: "relative", height: "100%", width: "100%" }}
        >
          <style>
            {`
              @keyframes career-core-breathe {
                0%, 100% { transform: translateY(0) scale(1); opacity: 0.92; }
                50% { transform: translateY(-2px) scale(1.015); opacity: 1; }
              }
              @keyframes career-core-ring {
                0%, 100% { transform: scale(0.96); opacity: 0.42; }
                50% { transform: scale(1.04); opacity: 0.72; }
              }
            `}
          </style>
          <CareerCoreScene state={engineState} />
        </div>
        {children ? (
          <div className="pointer-events-none absolute inset-0">{children}</div>
        ) : null}
      </div>
    </CareerCoreMotionProvider>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);

    function onChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}
