"use client";

import Link from "next/link";

import type { CareerCoreModuleId } from "@/core/career-core/types";
import { useCareerCoreMotionOverlay } from "@/core/career-core/motion/use-motion-overlay";

type WorkspaceModuleOverlaysProps = {
  highlightedModule: CareerCoreModuleId | null;
  onHighlight: (moduleId: CareerCoreModuleId | null) => void;
  moduleSecondaryLabels?: Partial<Record<CareerCoreModuleId, string>>;
  profilePanelExpanded?: boolean;
};

const modules = [
  {
    id: "resume" as const,
    glyph: "RS",
    label: "Resume",
    secondary: "Profile documents",
    collapsedPlacement: "top-[20%] left-[30%]",
    expandedPlacement: "top-[26%] left-[34%]",
    parallaxX: 14,
    parallaxY: 12,
    traceRotation: "rotate-[32deg]",
    href: "/workspace/resume" as string | null,
  },
  {
    id: "jobs" as const,
    glyph: "JB",
    label: "Jobs",
    secondary: "Active pipeline",
    collapsedPlacement: "top-[14%] right-[13%]",
    expandedPlacement: "top-[14%] right-[13%]",
    parallaxX: -12,
    parallaxY: 10,
    traceRotation: "-rotate-[28deg]",
    href: "/workspace/jobs" as string | null,
  },
  {
    id: "skills" as const,
    glyph: "SK",
    label: "Skills",
    secondary: "Capability map",
    collapsedPlacement: "bottom-[16%] left-[13%]",
    expandedPlacement: "bottom-[16%] left-[13%]",
    parallaxX: 10,
    parallaxY: -12,
    traceRotation: "-rotate-[24deg]",
    href: "/workspace/skills" as string | null,
  },
  {
    id: "analytics" as const,
    glyph: "AN",
    label: "Analytics",
    secondary: "Career signals",
    collapsedPlacement: "bottom-[16%] right-[13%]",
    expandedPlacement: "bottom-[16%] right-[13%]",
    parallaxX: -14,
    parallaxY: -10,
    traceRotation: "rotate-[26deg]",
    href: "/workspace/analytics" as string | null,
  },
];

export function WorkspaceModuleOverlays({
  highlightedModule,
  onHighlight,
  moduleSecondaryLabels,
  profilePanelExpanded = false,
}: WorkspaceModuleOverlaysProps) {
  return (
    <>
      {modules.map((module) => (
        <WorkspaceModuleControl
          highlightedModule={highlightedModule}
          key={module.id}
          module={module}
          moduleSecondaryLabels={moduleSecondaryLabels}
          onHighlight={onHighlight}
          profilePanelExpanded={profilePanelExpanded}
        />
      ))}
    </>
  );
}

function WorkspaceModuleControl({
  highlightedModule,
  module,
  moduleSecondaryLabels,
  onHighlight,
  profilePanelExpanded,
}: {
  highlightedModule: CareerCoreModuleId | null;
  module: (typeof modules)[number];
  moduleSecondaryLabels?: Partial<Record<CareerCoreModuleId, string>>;
  onHighlight: (moduleId: CareerCoreModuleId | null) => void;
  profilePanelExpanded: boolean;
}) {
  const motionRef = useCareerCoreMotionOverlay({
    parallaxX: module.parallaxX,
    parallaxY: module.parallaxY,
    depth: 1.05,
  });
  const isInteractive = !!module.href;
  const isHighlighted = isInteractive && highlightedModule === module.id;
  const secondaryLabel = moduleSecondaryLabels?.[module.id] ?? module.secondary;
  const placement = profilePanelExpanded
    ? module.expandedPlacement
    : module.collapsedPlacement;

  if (isInteractive && module.href) {
    return (
      <div
        ref={motionRef}
        className={`pointer-events-auto absolute ${placement} w-[156px] [transition:var(--motion-fade)]`}
      >
        <Link
          className={`group relative block w-full cursor-pointer overflow-hidden rounded-[var(--radius-xl)] border px-3 py-2.5 text-left backdrop-blur-xl [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            isHighlighted
              ? "border-[var(--color-border)] bg-[rgb(199_203_209_/_5%)] shadow-[0_0_18px_rgb(110_103_216_/_calc(var(--module-pulse-glow,0.06)*2))]"
              : "border-[var(--color-border-subtle)] bg-[var(--surface-glass)] hover:border-[var(--color-border)] hover:bg-[rgb(18_20_24_/_78%)]"
          }`}
          href={module.href}
          onPointerEnter={() => onHighlight(module.id)}
          onPointerLeave={() => onHighlight(null)}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -right-3 top-1/2 h-px w-14 origin-right bg-gradient-to-l from-[rgb(110_103_216_/_0%)] via-[rgb(110_103_216_/_28%)] to-[rgb(110_103_216_/_0%)] opacity-0 [transition:var(--motion-fade)] group-hover:opacity-100 ${module.traceRotation} ${
              isHighlighted ? "opacity-100" : ""
            }`}
          />
          <div className="flex items-start gap-2.5">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border text-[9px] font-semibold tracking-[0.12em] [transition:var(--motion-fade)] ${
                isHighlighted
                  ? "border-[var(--color-intelligence-border)] bg-[var(--color-intelligence-muted)] text-[var(--color-intelligence-soft)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--surface-inset)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
              }`}
            >
              {module.glyph}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium tracking-tight text-[var(--color-text-primary)]">
                {module.label}
              </span>
              <span className="block text-[10px] leading-4 text-[var(--color-text-secondary)]">
                {secondaryLabel}
              </span>
            </span>
          </div>
        </Link>
      </div>
    );
  }

  return null;
}
