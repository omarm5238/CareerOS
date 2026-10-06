import type { JobEvidenceMatchStrength, JobEvidenceType, JobRequirementCategory } from "@/generated/prisma/client";

import type { JobRequirementInput } from "../types";

export type EvidenceSemantic = "MATCHED" | "PARTIAL" | "MISSING" | "UNKNOWN";

const AMBIGUOUS = [
  "relevant experience",
  "modern technologies",
  "strong communication",
  "culture fit",
  "ownership",
  "fast learner",
];

export function isAmbiguousRequirement(requirement: Pick<JobRequirementInput, "normalizedName" | "rawText" | "category">): boolean {
  const text = `${requirement.normalizedName} ${requirement.rawText}`.toLowerCase();
  if (AMBIGUOUS.some((phrase) => text.includes(phrase))) return true;
  if (requirement.category === "OTHER" && /\b(or similar|related experience|and more)\b/i.test(text)) return true;
  return false;
}

export function commercialYears(requirement: Pick<JobRequirementInput, "normalizedName" | "rawText" | "sourceExcerpt" | "yearsRequired">): number | null {
  const chunks = `${requirement.normalizedName}\n${requirement.rawText}\n${requirement.sourceExcerpt}`.split(/\n|(?<=\.)\s+/);
  for (const chunk of chunks) {
    if (!/\b(commercial|professional)\b/i.test(chunk) || !/\d+\s*\+?\s*years?/i.test(chunk)) continue;
    const lower = chunk.toLowerCase();
    const mentionsRequirement = lower.includes(requirement.normalizedName.toLowerCase())
      || lower.includes(requirement.rawText.toLowerCase());
    if (!mentionsRequirement) continue;
    if (typeof requirement.yearsRequired === "number" && requirement.yearsRequired > 0) return requirement.yearsRequired;
    const match = chunk.match(/(\d+)\s*\+?\s*years?/i);
    if (!match) continue;
    const years = Number(match[1]);
    if (Number.isFinite(years) && years > 0) return years;
  }
  return null;
}

export function classifyEvidenceResult(input: {
  requirement: Pick<JobRequirementInput, "normalizedName" | "rawText" | "sourceExcerpt" | "yearsRequired" | "category">;
  matches: Array<{
    matchStrength: JobEvidenceMatchStrength;
    evidenceType: JobEvidenceType;
    verified?: boolean;
    commercial?: boolean;
    durationMonths?: number | null;
  }>;
}): EvidenceSemantic {
  if (isAmbiguousRequirement(input.requirement)) return "UNKNOWN";
  const verified = input.matches.filter((match) => match.verified !== false && match.matchStrength !== "NONE");
  if (verified.length === 0) return "MISSING";

  const years = commercialYears(input.requirement);
  if (years) {
    const requiredMonths = years * 12;
    const commercialWork = verified.filter((match) => match.evidenceType === "WORK_EXPERIENCE" && match.commercial !== false);
    const commercialEnough = commercialWork.some((match) =>
      typeof match.durationMonths === "number"
      && match.durationMonths >= requiredMonths
      && (match.matchStrength === "DIRECT" || match.matchStrength === "STRONG"),
    );
    if (commercialEnough) return "MATCHED";
    return commercialWork.length > 0 ? "PARTIAL" : "MISSING";
  }

  if (verified.some((match) => match.matchStrength === "DIRECT" || match.matchStrength === "STRONG")) return "MATCHED";
  if (verified.some((match) => match.matchStrength === "PARTIAL" || match.matchStrength === "TRANSFERABLE")) return "PARTIAL";
  return "MISSING";
}

export function categoryLabel(category: JobRequirementCategory): string {
  return category.replaceAll("_", " ").toLowerCase();
}
