import { prisma } from "@/server/db/prisma";

import { getLatestResumeAnalysisForUser } from "@/features/resume/lib/get-latest-resume-analysis-for-user";
import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";
import { normalizeToken } from "../lib/hash";
import type { CareerEvidenceItem } from "../types";

function tokensFrom(...parts: Array<string | null | undefined>): string[] {
  return parts
    .flatMap((part) => (part ? normalizeToken(part).split(" ") : []))
    .filter((token) => token.length > 1);
}

export async function buildCareerEvidence(userId: string): Promise<CareerEvidenceItem[]> {
  const items: CareerEvidenceItem[] = [];

  const analysis = await getLatestResumeAnalysisForUser(userId);
  if (analysis) {
    const skills = Array.isArray(analysis.detectedSkills)
      ? analysis.detectedSkills.filter((item): item is string => typeof item === "string")
      : [];
    for (const skill of skills) {
      items.push({
        evidenceType: "SKILL",
        evidenceSourceId: analysis.analysisId,
        evidenceLabel: skill,
        evidenceExcerpt: analysis.profileSummary?.slice(0, 220) ?? null,
        tokens: tokensFrom(skill, analysis.role, analysis.profileSummary),
      });
    }
    if (analysis.profileSummary) {
      items.push({
        evidenceType: "RESUME",
        evidenceSourceId: analysis.analysisId,
        evidenceLabel: analysis.role || "Resume profile",
        evidenceExcerpt: analysis.profileSummary.slice(0, 220),
        tokens: tokensFrom(analysis.role, analysis.profileSummary, analysis.experienceLevel),
      });
    }
  }

  const versions = await prisma.resumeVersion.findMany({
    where: { userId, archivedAt: null, activeRevisionId: { not: null } },
    select: {
      id: true,
      title: true,
      activeRevision: { select: { id: true, contentJson: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  for (const version of versions) {
    const content = parseResumeVersionContent(version.activeRevision?.contentJson);
    for (const skill of content.coreSkills) {
      items.push({
        evidenceType: "SKILL",
        evidenceSourceId: version.activeRevision?.id ?? version.id,
        evidenceLabel: skill,
        evidenceExcerpt: content.summary.slice(0, 180) || null,
        tokens: tokensFrom(skill),
      });
    }
    for (const group of content.technicalSkills) {
      for (const skill of group.skills) {
        items.push({
          evidenceType: "SKILL",
          evidenceSourceId: version.activeRevision?.id ?? version.id,
          evidenceLabel: skill,
          evidenceExcerpt: group.category || null,
          tokens: tokensFrom(skill, group.category),
        });
      }
    }
    for (const bullet of content.experienceBullets.slice(0, 8)) {
      items.push({
        evidenceType: "WORK_EXPERIENCE",
        evidenceSourceId: version.activeRevision?.id ?? version.id,
        evidenceLabel: bullet.source || "Work experience",
        evidenceExcerpt: bullet.tailored.slice(0, 220),
        tokens: tokensFrom(bullet.source, bullet.tailored, bullet.original),
      });
    }
    for (const project of content.projects.slice(0, 8)) {
      items.push({
        evidenceType: "PROJECT",
        evidenceSourceId: version.activeRevision?.id ?? version.id,
        evidenceLabel: project.source || "Project",
        evidenceExcerpt: project.tailored.slice(0, 220),
        tokens: tokensFrom(project.source, project.tailored, project.original),
      });
    }
    for (const education of content.education.slice(0, 4)) {
      items.push({
        evidenceType: "EDUCATION",
        evidenceSourceId: version.id,
        evidenceLabel: education,
        evidenceExcerpt: education,
        tokens: tokensFrom(education),
      });
    }
    for (const certification of content.certifications.slice(0, 4)) {
      items.push({
        evidenceType: "CERTIFICATION",
        evidenceSourceId: version.id,
        evidenceLabel: certification,
        evidenceExcerpt: certification,
        tokens: tokensFrom(certification),
      });
    }
  }

  return items;
}
