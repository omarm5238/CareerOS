"use client";

import { useEffect, useState } from "react";

import { CareerCore } from "@/components/core/CareerCore";
import type { CareerCoreModuleId } from "@/core/career-core/types";

const MODULES: Array<{
  id: CareerCoreModuleId;
  glyph: string;
  label: string;
  placement: string;
}> = [
  { id: "resume", glyph: "RS", label: "Resume", placement: "left-[8%] top-[18%]" },
  { id: "jobs", glyph: "JB", label: "Jobs", placement: "right-[8%] top-[16%]" },
  { id: "skills", glyph: "SK", label: "Skills", placement: "left-[10%] bottom-[18%]" },
  {
    id: "analytics",
    glyph: "AN",
    label: "Analytics",
    placement: "right-[8%] bottom-[16%]",
  },
];

export function LandingCoreVisual() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");

    function update() {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setAnimated(media.matches && !prefersReducedMotion);
    }

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[2rem] border border-[rgb(207_193_154_/_18%)] bg-[linear-gradient(145deg,rgb(20_22_27_/_82%),rgb(8_10_13_/_55%))] shadow-[var(--shadow-xl)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgb(91_86_152_/_7%),transparent_58%),radial-gradient(circle_at_50%_48%,rgb(207_193_154_/_4%),transparent_48%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(207_193_154_/_35%)] to-transparent" />
      <CareerCore
        animated={animated}
        className="absolute inset-0"
        density="low"
        interactive={false}
        mode="presentation"
        pulse={animated}
      />
      <div className="pointer-events-none absolute inset-0">
        {MODULES.map((module) => (
          <div
            className={`absolute ${module.placement} flex items-center gap-2 surface-card border-[var(--color-border)] px-2.5 py-1.5 backdrop-blur-md`}
            key={module.id}
          >
            <span className="font-mono-meta flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-intelligence-border)] bg-[var(--color-intelligence-muted)] text-[9px] font-semibold tracking-[0.12em] text-[var(--color-intelligence-soft)]">
              {module.glyph}
            </span>
            <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
              {module.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
