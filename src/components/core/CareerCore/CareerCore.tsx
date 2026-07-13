"use client";

import { CareerCoreEngine, type CareerCoreProps } from "@/core/career-core";

export function CareerCore({
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
  return (
    <CareerCoreEngine
      accent={accent}
      animated={animated}
      className={className}
      density={density}
      highlightedModule={highlightedModule}
      interactive={interactive}
      mode={mode}
      pulse={pulse}
    >
      {children}
    </CareerCoreEngine>
  );
}
