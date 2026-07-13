import type { ReactNode } from "react";

export type CareerCoreMode =
  | "idle"
  | "signin"
  | "signup"
  | "workspace"
  | "loading"
  | "presentation";

export type CareerCoreModuleId = "resume" | "jobs" | "skills" | "analytics";

export type CareerCoreDensity = "low" | "medium" | "high";

export type CareerCoreAccent = "indigo";

export type CareerCoreNodeState = "dormant" | "active" | "focused";

export type CareerCoreNode = {
  id: string;
  label: string;
  shortLabel: string;
  position: {
    x: number;
    y: number;
  };
  depth: number;
  state: CareerCoreNodeState;
};

export type CareerCoreConnection = {
  id: string;
  from: "core";
  to: CareerCoreNode["id"];
  strength: number;
};

export type CareerCorePointerState = {
  x: number;
  y: number;
  active: boolean;
};

export type CareerCoreEngineState = {
  mode: CareerCoreMode;
  density: CareerCoreDensity;
  accent: CareerCoreAccent;
  interactive: boolean;
  pulse: boolean;
  animated: boolean;
  pointer: CareerCorePointerState;
  highlightedModule: CareerCoreModuleId | null;
  reducedMotion: boolean;
};

export type CareerCoreModeVisualConfig = {
  cameraDistance: number;
  cameraFov: number;
  connectionOpacity: number;
  connectionPulse: number;
  densityFactor: number;
  fogFar: number;
  fogNear: number;
  labelMode: "none" | "modules";
  nodeOpacity: number;
  pointScale: number;
  rootIntensity: number;
  targetHeightRatio: number;
  targetWidthRatio: number;
};

export type CareerCoreProps = {
  mode?: CareerCoreMode;
  interactive?: boolean;
  pulse?: boolean;
  animated?: boolean;
  density?: CareerCoreDensity;
  accent?: CareerCoreAccent;
  className?: string;
  highlightedModule?: CareerCoreModuleId | null;
  children?: ReactNode;
};
