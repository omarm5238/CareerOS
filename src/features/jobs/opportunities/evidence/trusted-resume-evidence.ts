import type { EvidenceCatalog } from "@/features/resume/provenance/evidence-catalog";

import { normalizeToken } from "../lib/hash";
import type { CareerEvidenceItem } from "../types";

function tokensFrom(...parts: Array<string | null | undefined>): string[] {
  return parts
    .flatMap((part) => (part ? normalizeToken(part).split(" ") : []))
    .filter((token) => token.length > 1);
}

export function evidenceFromCatalog(
  catalog: EvidenceCatalog | null,
  analysisId: string,
  detectedSkills: string[],
): CareerEvidenceItem[] {
  const items: CareerEvidenceItem[] = [];
  const skills = catalog?.skills.map((skill) => skill.label) ?? detectedSkills;
  for (const skill of skills) {
    items.push({
      evidenceType: "SKILL",
      evidenceSourceId: analysisId,
      evidenceLabel: skill,
      evidenceExcerpt: catalog?.skills.find((item) => item.label === skill)?.excerpt ?? null,
      tokens: tokensFrom(skill),
      commercial: false,
      durationMonths: null,
    });
  }
  for (const experience of catalog?.experiences ?? []) {
    items.push({
      evidenceType: "WORK_EXPERIENCE",
      evidenceSourceId: analysisId,
      evidenceLabel: experience.label,
      evidenceExcerpt: [experience.excerpt, ...experience.technologies].join(" "),
      tokens: tokensFrom(experience.label, experience.excerpt, ...experience.technologies),
      commercial: experience.commercial,
      durationMonths: experience.durationMonths,
    });
  }
  for (const project of catalog?.projects ?? []) {
    items.push({
      evidenceType: "PROJECT",
      evidenceSourceId: analysisId,
      evidenceLabel: project.label,
      evidenceExcerpt: [project.excerpt, ...project.technologies].join(" "),
      tokens: tokensFrom(project.label, project.excerpt, ...project.technologies),
      commercial: false,
      durationMonths: null,
    });
  }
  for (const link of catalog?.links ?? []) {
    items.push({
      evidenceType: "PORTFOLIO",
      evidenceSourceId: analysisId,
      evidenceLabel: link.url,
      evidenceExcerpt: link.excerpt,
      tokens: tokensFrom(link.url, link.kind),
      commercial: false,
      durationMonths: null,
    });
  }
  for (const education of catalog?.education ?? []) {
    items.push({
      evidenceType: "EDUCATION",
      evidenceSourceId: analysisId,
      evidenceLabel: education.label,
      evidenceExcerpt: education.excerpt,
      tokens: tokensFrom(education.label, education.excerpt),
      commercial: false,
      durationMonths: null,
    });
  }
  return items;
}
