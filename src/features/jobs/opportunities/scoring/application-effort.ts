import type { ApplicationEffort } from "@/generated/prisma/client";

import { EFFORT_SCORES } from "../types";

export function classifyApplicationEffort(input: {
  requiresCoverLetter: boolean;
  requiresPortfolio: boolean;
  requiresAssessment: boolean;
  applyByEmail: boolean;
  sourceHint: string | null;
}): ApplicationEffort {
  const known =
    input.requiresCoverLetter ||
    input.requiresPortfolio ||
    input.requiresAssessment ||
    input.applyByEmail ||
    Boolean(input.sourceHint);

  if (!known) return "UNKNOWN";

  let load = 0;
  if (input.requiresCoverLetter) load += 1;
  if (input.requiresPortfolio) load += 1;
  if (input.requiresAssessment) load += 2;
  if (input.applyByEmail) load += 1;

  if (load >= 3) return "HIGH";
  if (load >= 2) return "MEDIUM";
  return "LOW";
}

export function effortScore(effort: ApplicationEffort): number {
  return EFFORT_SCORES[effort];
}
