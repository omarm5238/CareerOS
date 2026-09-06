import type { JobEvidenceMatchStrength } from "@/generated/prisma/client";

import { normalizeToken } from "../lib/hash";
import type { CareerEvidenceItem, JobEvidenceView, JobRequirementInput } from "../types";

const RELATED: Record<string, string[]> = {
  docker: ["container", "deployment", "backend", "ci", "cd", "linux"],
  kubernetes: ["docker", "container", "orchestration", "deployment"],
  aws: ["cloud", "deployment", "s3", "lambda"],
  azure: ["cloud", "deployment"],
  gcp: ["cloud", "deployment"],
  "rest apis": ["api", "backend", "node", "express", "http"],
  "rest api": ["api", "backend", "node", "express", "http"],
  postgresql: ["sql", "database", "prisma", "postgres"],
  prisma: ["postgresql", "orm", "database"],
};

const STRENGTH_RANK: Record<JobEvidenceMatchStrength, number> = {
  DIRECT: 5,
  STRONG: 4,
  PARTIAL: 3,
  TRANSFERABLE: 2,
  NONE: 1,
};

function includesNormalized(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `) || haystack.includes(needle);
}

function scoreMatch(requirement: JobRequirementInput, evidence: CareerEvidenceItem): JobEvidenceMatchStrength | null {
  const name = normalizeToken(requirement.normalizedName);
  const haystack = normalizeToken([evidence.evidenceLabel, evidence.evidenceExcerpt, ...evidence.tokens].join(" "));

  if (!name) return null;
  if (includesNormalized(haystack, name)) return "DIRECT";

  const aliases = name === "go" ? ["golang"] : name.split(" ");
  if (aliases.some((alias) => alias.length > 2 && includesNormalized(haystack, alias))) {
    return name.split(" ").length > 1 ? "STRONG" : "DIRECT";
  }

  const related = RELATED[name] ?? [];
  if (related.some((token) => includesNormalized(haystack, token))) return "TRANSFERABLE";

  return null;
}

export function mapEvidenceForRequirement(
  requirement: JobRequirementInput,
  evidence: CareerEvidenceItem[],
): JobEvidenceView[] {
  if (requirement.category === "AUTHORIZATION" || requirement.category === "SECURITY_CLEARANCE") {
    return [
      {
        evidenceType: "OTHER",
        evidenceSourceId: null,
        evidenceLabel: "No confirmed user fact",
        evidenceExcerpt: null,
        matchStrength: "NONE",
        reasoning: `${requirement.normalizedName} needs explicit user confirmation. CareerOS does not infer this from resume, location, or nationality.`,
      },
    ];
  }

  const matches: JobEvidenceView[] = [];

  for (const item of evidence) {
    const strength = scoreMatch(requirement, item);
    if (!strength) continue;
    matches.push({
      evidenceType: item.evidenceType,
      evidenceSourceId: item.evidenceSourceId,
      evidenceLabel: item.evidenceLabel,
      evidenceExcerpt: item.evidenceExcerpt,
      matchStrength: strength,
      reasoning:
        strength === "TRANSFERABLE"
          ? `Related ${item.evidenceType.toLowerCase().replaceAll("_", " ")} evidence exists. Do not claim ${requirement.normalizedName} proficiency.`
          : `Stored CareerOS evidence supports ${requirement.normalizedName}.`,
    });
  }

  matches.sort((a, b) => {
    const rank = STRENGTH_RANK[b.matchStrength] - STRENGTH_RANK[a.matchStrength];
    if (rank !== 0) return rank;
    const name = normalizeToken(requirement.normalizedName);
    const aHit = Number(normalizeToken(`${a.evidenceLabel} ${a.evidenceExcerpt ?? ""}`).includes(name));
    const bHit = Number(normalizeToken(`${b.evidenceLabel} ${b.evidenceExcerpt ?? ""}`).includes(name));
    return bHit - aHit;
  });

  const unique: JobEvidenceView[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = `${match.evidenceLabel}:${match.matchStrength}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
    if (unique.length >= 3) break;
  }

  if (unique.length === 0) {
    unique.push({
      evidenceType: "OTHER",
      evidenceSourceId: null,
      evidenceLabel: "No stored CareerOS evidence",
      evidenceExcerpt: null,
      matchStrength: "NONE",
      reasoning: `No stored CareerOS evidence demonstrates ${requirement.normalizedName}.`,
    });
  }

  return unique;
}

export function bestEvidenceStrength(matches: JobEvidenceView[]): JobEvidenceMatchStrength {
  return matches[0]?.matchStrength ?? "NONE";
}
