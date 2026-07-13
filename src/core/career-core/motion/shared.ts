import type { CareerCoreModuleId } from "../types";

export type CareerCoreMotionSnapshot = {
  pointerX: number;
  pointerY: number;
  pulsePhase: number;
  reducedMotion: boolean;
  hoveredModule: CareerCoreModuleId | null;
};

export type CareerCoreMotionStore = {
  snapshot: CareerCoreMotionSnapshot;
  containerRef: { current: HTMLElement | null };
};

export function createCareerCoreMotionStore(): CareerCoreMotionStore {
  return {
    snapshot: {
      pointerX: 0,
      pointerY: 0,
      pulsePhase: 0,
      reducedMotion: false,
      hoveredModule: null,
    },
    containerRef: { current: null },
  };
}

export function syncMotionCssProperties(
  container: HTMLElement,
  snapshot: CareerCoreMotionSnapshot,
) {
  container.style.setProperty("--career-core-pointer-x", String(snapshot.pointerX));
  container.style.setProperty("--career-core-pointer-y", String(snapshot.pointerY));
  container.style.setProperty("--career-core-pulse-phase", String(snapshot.pulsePhase));
}
