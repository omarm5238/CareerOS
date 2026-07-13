"use client";

import Link from "next/link";

import type { CareerCoreModuleId } from "@/core/career-core/types";
import { useCareerCoreMotionOverlay } from "@/core/career-core/motion/use-motion-overlay";

type WorkspaceModuleOverlaysProps = {
  highlightedModule: CareerCoreModuleId | null;
  onHighlight: (moduleId: CareerCoreModuleId | null) => void;
  moduleSecondaryLabels?: Partial<Record<CareerCoreModuleId, string>>;
};

const modules = [
  {
    id: "resume" as const,
    glyph: "RS",
    label: "Resume",
    secondary: "Profile documents",
    placement: "top-[17%] left-[11%]",
    parallaxX: 16,
    parallaxY: 14,
    traceRotation: "rotate-[32deg]",
    href: "/workspace/resume" as string | null,
  },
  {
    id: "jobs" as const,
    glyph: "JB",
    label: "Jobs",
    secondary: "Active pipeline",
    placement: "top-[17%] right-[11%]",
    parallaxX: -14,
    parallaxY: 12,
    traceRotation: "-rotate-[28deg]",
    href: "/workspace/jobs" as string | null,
  },
  {
    id: "skills" as const,
    glyph: "SK",
    label: "Skills",
    secondary: "Capability map",
    placement: "bottom-[17%] left-[11%]",
    parallaxX: 12,
    parallaxY: -14,
    traceRotation: "-rotate-[24deg]",
    href: "/workspace/skills" as string | null,
  },
  {
    id: "analytics" as const,
    glyph: "AN",
    label: "Analytics",
    secondary: "Career signals",
    placement: "bottom-[17%] right-[11%]",
    parallaxX: -16,
    parallaxY: -12,
    traceRotation: "rotate-[26deg]",
    href: "/workspace/analytics" as string | null,
  },
];

export function WorkspaceModuleOverlays({
  highlightedModule,
  onHighlight,
  moduleSecondaryLabels,
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
}: {
  highlightedModule: CareerCoreModuleId | null;
  module: (typeof modules)[number];
  moduleSecondaryLabels?: Partial<Record<CareerCoreModuleId, string>>;
  onHighlight: (moduleId: CareerCoreModuleId | null) => void;
}) {
  const motionRef = useCareerCoreMotionOverlay({
    parallaxX: module.parallaxX,
    parallaxY: module.parallaxY,
    depth: 1.05,
  });
  const isInteractive = !!module.href;
  const isHighlighted = isInteractive && highlightedModule === module.id;
  const secondaryLabel = moduleSecondaryLabels?.[module.id] ?? module.secondary;

  if (isInteractive && module.href) {
    return (
      <div
        ref={motionRef}
        className={`pointer-events-auto absolute ${module.placement} w-[168px] [transition:var(--motion-fade)]`}
      >
        <Link
          className={`group relative block w-full cursor-pointer overflow-hidden rounded-[var(--radius-xl)] border px-4 py-3 text-left backdrop-blur-xl [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            isHighlighted
              ? "border-[rgb(99_102_241_/_42%)] bg-[rgb(99_102_241_/_10%)] shadow-[0_0_24px_rgb(99_102_241_/_calc(var(--module-pulse-glow,0.08)*3))]"
              : "border-[rgb(245_245_245_/_8%)] bg-[rgb(17_17_17_/_62%)] hover:border-[rgb(99_102_241_/_24%)] hover:bg-[rgb(23_23_23_/_72%)]"
          }`}
          href={module.href}
          onPointerEnter={() => onHighlight(module.id)}
          onPointerLeave={() => onHighlight(null)}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -right-3 top-1/2 h-px w-16 origin-right bg-gradient-to-l from-[rgb(99_102_241_/_0%)] via-[rgb(99_102_241_/_38%)] to-[rgb(99_102_241_/_0%)] opacity-0 [transition:var(--motion-fade)] group-hover:opacity-100 ${module.traceRotation} ${
              isHighlighted ? "opacity-100" : ""
            }`}
          />
          <div className="flex items-start gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border text-[10px] font-semibold tracking-[0.12em] [transition:var(--motion-fade)] ${
                isHighlighted
                  ? "border-[rgb(99_102_241_/_36%)] bg-[rgb(99_102_241_/_14%)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_72%)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
              }`}
            >
              {module.glyph}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium tracking-tight text-[var(--color-text-primary)]">
                {module.label}
              </span>
              <span className="block text-[11px] leading-4 text-[var(--color-text-secondary)]">
                {secondaryLabel}
              </span>
            </span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={motionRef}
      aria-disabled="true"
      className={`pointer-events-none absolute ${module.placement} w-[168px] cursor-default [transition:var(--motion-fade)]`}
    >
      <div className="relative w-full overflow-hidden rounded-[var(--radius-xl)] border border-[rgb(245_245_245_/_6%)] bg-[rgb(17_17_17_/_48%)] px-4 py-3 text-left opacity-70 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_60%)] text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-secondary)]">
            {module.glyph}
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium tracking-tight text-[var(--color-text-secondary)]">
              {module.label}
            </span>
            <span className="block text-[11px] leading-4 text-[var(--color-text-secondary)]">
              {secondaryLabel}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)] opacity-80">
              Coming soon
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
