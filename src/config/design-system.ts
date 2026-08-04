/**
 * CareerOS Design System
 *
 * TypeScript mirror of src/styles/tokens.css.
 * Use these exports when TypeScript needs to reference visual foundation tokens.
 */

export const colorTokens = {
  background: "var(--color-background)",
  surface: "var(--color-surface)",
  surfaceElevated: "var(--color-surface-elevated)",
  border: "var(--color-border)",
  borderSubtle: "var(--color-border-subtle)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  accent: "var(--color-accent)",
  accentMuted: "var(--color-accent-muted)",
  silver: "var(--color-silver)",
  champagne: "var(--color-champagne)",
  intelligence: "var(--color-intelligence)",
  statusSuccess: "var(--status-success-text)",
  statusWarning: "var(--status-warning-text)",
  statusDanger: "var(--status-danger-text)",
  statusInfo: "var(--status-info-text)",
} as const;

export const typographyTokens = {
  fontFamily: {
    sans: "var(--font-sans)",
    display: "var(--font-display)",
    mono: "var(--font-mono)",
  },
  fontSize: {
    xs: "var(--font-size-xs)",
    sm: "var(--font-size-sm)",
    md: "var(--font-size-md)",
    lg: "var(--font-size-lg)",
    xl: "var(--font-size-xl)",
    "2xl": "var(--font-size-2xl)",
    "3xl": "var(--font-size-3xl)",
  },
  lineHeight: {
    tight: "var(--line-height-tight)",
    normal: "var(--line-height-normal)",
    relaxed: "var(--line-height-relaxed)",
  },
  fontWeight: {
    regular: "var(--font-weight-regular)",
    medium: "var(--font-weight-medium)",
    semibold: "var(--font-weight-semibold)",
    bold: "var(--font-weight-bold)",
  },
} as const;

export const spacingTokens = {
  0: "var(--spacing-0)",
  px: "var(--spacing-px)",
  1: "var(--spacing-1)",
  2: "var(--spacing-2)",
  3: "var(--spacing-3)",
  4: "var(--spacing-4)",
  5: "var(--spacing-5)",
  6: "var(--spacing-6)",
  8: "var(--spacing-8)",
  10: "var(--spacing-10)",
  12: "var(--spacing-12)",
  16: "var(--spacing-16)",
  20: "var(--spacing-20)",
  24: "var(--spacing-24)",
} as const;

export const radiusTokens = {
  none: "var(--radius-none)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  full: "var(--radius-full)",
} as const;

export const shadowTokens = {
  none: "var(--shadow-none)",
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  accentGlow: "var(--shadow-accent-glow)",
} as const;

export const surfaceTokens = {
  matteGraphite: "var(--surface-matte-graphite)",
  softGlass: "var(--surface-soft-glass)",
  softGlassBorder: "var(--surface-soft-glass-border)",
  accentGlow: "var(--surface-accent-glow)",
} as const;

export const zIndexTokens = {
  base: "var(--z-base)",
  dropdown: "var(--z-dropdown)",
  sticky: "var(--z-sticky)",
  overlay: "var(--z-overlay)",
  modal: "var(--z-modal)",
  toast: "var(--z-toast)",
  tooltip: "var(--z-tooltip)",
} as const;

export const durationTokens = {
  instant: "var(--duration-instant)",
  fast: "var(--duration-fast)",
  normal: "var(--duration-normal)",
  slow: "var(--duration-slow)",
  slower: "var(--duration-slower)",
} as const;

export const motionTokens = {
  duration: durationTokens,
  easing: {
    standard: "var(--ease-standard)",
    emphasized: "var(--ease-emphasized)",
    exit: "var(--ease-exit)",
  },
  preset: {
    fade: "var(--motion-fade)",
    slide: "var(--motion-slide)",
  },
} as const;

export const designTokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  surface: surfaceTokens,
  zIndex: zIndexTokens,
  duration: durationTokens,
  motion: motionTokens,
} as const;

export type ColorToken = keyof typeof colorTokens;
export type TypographyToken = keyof typeof typographyTokens;
export type SpacingToken = keyof typeof spacingTokens;
export type RadiusToken = keyof typeof radiusTokens;
export type ShadowToken = keyof typeof shadowTokens;
export type SurfaceToken = keyof typeof surfaceTokens;
export type ZIndexToken = keyof typeof zIndexTokens;
export type DurationToken = keyof typeof durationTokens;
export type MotionToken = keyof typeof motionTokens;

export type DesignTokens = typeof designTokens;
