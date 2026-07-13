"use client";

import { PointerEvent, useMemo, useState } from "react";

import {
  careerCoreAnimationIntensityConfig,
  careerCoreMotionTimingConfig,
} from "../config";
import type {
  CareerCoreEngineState,
  CareerCoreMode,
  CareerCorePointerState,
} from "../types";

const defaultPointer: CareerCorePointerState = {
  x: 0,
  y: 0,
  active: false,
};

export function useCareerCoreMotion(state: CareerCoreEngineState) {
  const [pointer, setPointer] = useState<CareerCorePointerState>(defaultPointer);

  const intensity = careerCoreAnimationIntensityConfig[state.mode];
  const timing = careerCoreMotionTimingConfig[state.mode];

  const parallax = useMemo(
    () => ({
      x: pointer.x * intensity.parallax,
      y: pointer.y * intensity.parallax,
      nodeX: pointer.x * intensity.parallax * intensity.nodeReaction,
      nodeY: pointer.y * intensity.parallax * intensity.nodeReaction,
      connectionOpacity:
        0.34 + Math.abs(pointer.x + pointer.y) * intensity.connectionReaction * 0.12,
    }),
    [intensity.connectionReaction, intensity.nodeReaction, intensity.parallax, pointer.x, pointer.y],
  );

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!state.interactive) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    setPointer({
      x,
      y,
      active: true,
    });
  }

  function onPointerLeave() {
    setPointer(defaultPointer);
  }

  return {
    pointer,
    parallax,
    timing,
    pulseScale: state.pulse ? intensity.pulseScale : "1",
    eventHandlers: {
      onPointerMove,
      onPointerLeave,
    },
  };
}

export function getModeMotionName(mode: CareerCoreMode) {
  return `career-core-${mode}`;
}
