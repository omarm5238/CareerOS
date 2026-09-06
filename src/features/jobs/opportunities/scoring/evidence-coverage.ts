import type { JobEvidenceMatchStrength, JobRequirementImportance } from "@/generated/prisma/client";

import { EVIDENCE_MULTIPLIERS, IMPORTANCE_WEIGHTS } from "../types";

export type CoverageInput = {
  importance: JobRequirementImportance;
  bestStrength: JobEvidenceMatchStrength;
};

export function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function calculateEvidenceCoverage(requirements: CoverageInput[]): number {
  if (requirements.length === 0) return 0;

  let weighted = 0;
  let total = 0;
  for (const item of requirements) {
    const weight = IMPORTANCE_WEIGHTS[item.importance];
    total += weight;
    weighted += weight * EVIDENCE_MULTIPLIERS[item.bestStrength];
  }

  if (total === 0) return 0;
  return clampScore((weighted / total) * 100);
}
