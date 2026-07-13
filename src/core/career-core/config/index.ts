import type {
  CareerCoreAccent,
  CareerCoreDensity,
  CareerCoreMode,
  CareerCoreModeVisualConfig,
  CareerCoreNode,
} from "../types";

export const careerCoreModes = [
  "idle",
  "signin",
  "signup",
  "workspace",
  "loading",
  "presentation",
] as const satisfies readonly CareerCoreMode[];

export const careerCoreModeConfig: Record<
  CareerCoreMode,
  {
    labelVisibility: "none" | "subtle" | "full";
    scale: string;
    opacity: string;
    nodeBias: number;
  }
> = {
  idle: {
    labelVisibility: "subtle",
    scale: "scale-95",
    opacity: "opacity-80",
    nodeBias: 0.6,
  },
  signin: {
    labelVisibility: "none",
    scale: "scale-105",
    opacity: "opacity-90",
    nodeBias: 0.72,
  },
  signup: {
    labelVisibility: "none",
    scale: "scale-105",
    opacity: "opacity-90",
    nodeBias: 0.78,
  },
  workspace: {
    labelVisibility: "full",
    scale: "scale-100",
    opacity: "opacity-100",
    nodeBias: 1,
  },
  loading: {
    labelVisibility: "none",
    scale: "scale-95",
    opacity: "opacity-75",
    nodeBias: 0.7,
  },
  presentation: {
    labelVisibility: "full",
    scale: "scale-105",
    opacity: "opacity-100",
    nodeBias: 1,
  },
};

export const careerCoreDensityConfig: Record<
  CareerCoreDensity,
  {
    nodeCount: number;
    ringCount: number;
  }
> = {
  low: {
    nodeCount: 4,
    ringCount: 2,
  },
  medium: {
    nodeCount: 4,
    ringCount: 3,
  },
  high: {
    nodeCount: 6,
    ringCount: 4,
  },
};

export const careerCoreAccentConfig: Record<
  CareerCoreAccent,
  {
    color: string;
    muted: string;
    glow: string;
  }
> = {
  indigo: {
    color: "var(--color-accent)",
    muted: "var(--color-accent-muted)",
    glow: "var(--shadow-accent-glow)",
  },
};

export const careerCoreAnimationIntensityConfig: Record<
  CareerCoreMode,
  {
    pulseScale: string;
    parallax: number;
    nodeReaction: number;
    connectionReaction: number;
  }
> = {
  idle: {
    pulseScale: "1.015",
    parallax: 8,
    nodeReaction: 0.45,
    connectionReaction: 0.35,
  },
  signin: {
    pulseScale: "1.018",
    parallax: 8,
    nodeReaction: 0.42,
    connectionReaction: 0.45,
  },
  signup: {
    pulseScale: "1.018",
    parallax: 9,
    nodeReaction: 0.48,
    connectionReaction: 0.48,
  },
  workspace: {
    pulseScale: "1.035",
    parallax: 18,
    nodeReaction: 0.9,
    connectionReaction: 0.82,
  },
  loading: {
    pulseScale: "1.018",
    parallax: 4,
    nodeReaction: 0.35,
    connectionReaction: 0.4,
  },
  presentation: {
    pulseScale: "1.024",
    parallax: 16,
    nodeReaction: 0.85,
    connectionReaction: 0.72,
  },
};

export const careerCoreMotionTimingConfig: Record<
  CareerCoreMode,
  {
    duration: string;
    easing: string;
  }
> = {
  idle: {
    duration: "var(--duration-slower)",
    easing: "var(--ease-standard)",
  },
  signin: {
    duration: "var(--duration-slow)",
    easing: "var(--ease-standard)",
  },
  signup: {
    duration: "var(--duration-slow)",
    easing: "var(--ease-standard)",
  },
  workspace: {
    duration: "var(--duration-normal)",
    easing: "var(--ease-emphasized)",
  },
  loading: {
    duration: "var(--duration-fast)",
    easing: "var(--ease-standard)",
  },
  presentation: {
    duration: "var(--duration-slower)",
    easing: "var(--ease-emphasized)",
  },
};

export const careerCoreModeVisualConfig: Record<
  "signin" | "signup" | "workspace" | "presentation",
  CareerCoreModeVisualConfig
> = {
  signin: {
    cameraDistance: 12,
    cameraFov: 42,
    connectionOpacity: 0.09,
    connectionPulse: 0.14,
    densityFactor: 0.68,
    fogFar: 28,
    fogNear: 9,
    labelMode: "none",
    nodeOpacity: 0.68,
    pointScale: 120,
    rootIntensity: 0.32,
    targetHeightRatio: 0.72,
    targetWidthRatio: 0.7,
  },
  signup: {
    cameraDistance: 12,
    cameraFov: 42,
    connectionOpacity: 0.1,
    connectionPulse: 0.16,
    densityFactor: 0.72,
    fogFar: 28,
    fogNear: 9,
    labelMode: "none",
    nodeOpacity: 0.72,
    pointScale: 122,
    rootIntensity: 0.34,
    targetHeightRatio: 0.74,
    targetWidthRatio: 0.72,
  },
  workspace: {
    cameraDistance: 12,
    cameraFov: 42,
    connectionOpacity: 0.1,
    connectionPulse: 0.18,
    densityFactor: 0.86,
    fogFar: 28,
    fogNear: 9,
    labelMode: "none",
    nodeOpacity: 0.84,
    pointScale: 138,
    rootIntensity: 0.3,
    targetHeightRatio: 0.68,
    targetWidthRatio: 0.72,
  },
  presentation: {
    cameraDistance: 12,
    cameraFov: 42,
    connectionOpacity: 0.14,
    connectionPulse: 0.28,
    densityFactor: 1,
    fogFar: 28,
    fogNear: 9,
    labelMode: "none",
    nodeOpacity: 1,
    pointScale: 155,
    rootIntensity: 0.36,
    targetHeightRatio: 0.74,
    targetWidthRatio: 0.64,
  },
};

export const careerCoreBaseNodes: CareerCoreNode[] = [
  {
    id: "resume",
    label: "Resume",
    shortLabel: "RS",
    position: { x: 18, y: 26 },
    depth: 0.72,
    state: "active",
  },
  {
    id: "jobs",
    label: "Jobs",
    shortLabel: "JB",
    position: { x: 82, y: 28 },
    depth: 0.68,
    state: "active",
  },
  {
    id: "skills",
    label: "Skills",
    shortLabel: "SK",
    position: { x: 24, y: 74 },
    depth: 0.58,
    state: "active",
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "AN",
    position: { x: 80, y: 72 },
    depth: 0.64,
    state: "active",
  },
  {
    id: "growth",
    label: "Growth",
    shortLabel: "GR",
    position: { x: 50, y: 18 },
    depth: 0.42,
    state: "dormant",
  },
  {
    id: "signal",
    label: "Signal",
    shortLabel: "SG",
    position: { x: 52, y: 82 },
    depth: 0.36,
    state: "dormant",
  },
];
