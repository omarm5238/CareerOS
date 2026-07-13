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
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[2rem] border border-[var(--color-border-subtle)] bg-[linear-gradient(145deg,rgb(17_17_17_/_52%),rgb(10_10_10_/_24%))] shadow-[var(--shadow-lg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgb(99_102_241_/_14%),transparent_58%)]" />
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
            className={`absolute ${module.placement} flex items-center gap-2 rounded-[var(--radius-lg)] border border-[rgb(245_245_245_/_8%)] bg-[rgb(17_17_17_/_62%)] px-2.5 py-1.5 backdrop-blur-md`}
            key={module.id}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] border border-[rgb(99_102_241_/_28%)] bg-[rgb(99_102_241_/_10%)] text-[9px] font-semibold tracking-[0.12em] text-[var(--color-accent)]">
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
