import { prisma } from "@/server/db/prisma";

import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";

import { sha1Fingerprint } from "../lib/fingerprint";
import { asString, asStringArray, isRecord } from "../lib/json-parsers";
import type { LinkedinCareerContext, LinkedinEvidenceItem } from "../types";
import { sanitizeLinkedinCareerContext } from "./sanitize-linkedin-career-context";

function slugId(prefix: string, label: string): string {
  return `${prefix}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
}

export async function buildLinkedinCareerContext(userId: string): Promise<LinkedinCareerContext> {
  const [discovery, resumeAnalysis, resumeVersion, skills, brief, requirements, applications] =
    await Promise.all([
      prisma.jobDiscoveryProfile.findUnique({ where: { userId } }),
      prisma.resumeAnalysis.findFirst({
        where: { resumeDocument: { userId } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.resumeVersion.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { activeRevision: true },
      }),
      prisma.skillsInsight.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      prisma.careerBrief.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      prisma.jobRequirement.groupBy({
        by: ["normalizedName"],
        where: {
          userId,
          category: { in: ["SKILL", "EXPERIENCE", "EDUCATION", "LANGUAGE", "CERTIFICATION"] },
        },
        _count: { normalizedName: true },
        orderBy: { _count: { normalizedName: "desc" } },
        take: 12,
      }),
      prisma.application.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { jobPosting: { select: { title: true, company: true } } },
      }),
    ]);

  const targetRoles: string[] = [...asStringArray(discovery?.roleTargetsJson, 8)];
  if (Array.isArray(discovery?.roleTargetsJson)) {
    for (const entry of discovery.roleTargetsJson) {
      if (!isRecord(entry)) continue;
      const label = asString(entry.title) ?? asString(entry.role) ?? asString(entry.name);
      if (label) targetRoles.push(label);
    }
  }

  const content = resumeVersion?.activeRevision
    ? parseResumeVersionContent(resumeVersion.activeRevision.contentJson)
    : null;

  const verifiedSkills = [
    ...asStringArray(resumeAnalysis?.detectedSkills, 16),
    ...(content?.coreSkills ?? []),
    ...(content?.technicalSkills ?? []).flatMap((group) => group.skills),
  ];

  const projects = (content?.projects ?? []).map((item) => item.tailored || item.original || item.source).filter(Boolean);
  const education = content?.education ?? [];
  const workHistory = (content?.experienceBullets ?? [])
    .map((item) => item.tailored || item.original || item.source)
    .filter(Boolean);
  const certifications = content?.certifications ?? [];

  const jobRequirementPatterns = requirements.map((row) => ({
    name: row.normalizedName,
    count: row._count.normalizedName,
  }));

  const recentApplicationPatterns = applications.map((application) => ({
    title: application.jobPosting?.title ?? "Role",
    company: application.jobPosting?.company ?? "Company",
    status: application.status,
  }));

  const evidence: LinkedinEvidenceItem[] = [];
  for (const skill of unique(verifiedSkills).slice(0, 16)) {
    evidence.push({ id: slugId("skill", skill), kind: "SKILL", label: skill, strength: "STRONG" });
  }
  for (const project of unique(projects).slice(0, 6)) {
    evidence.push({ id: slugId("project", project), kind: "PROJECT", label: project, strength: "MODERATE" });
  }
  for (const role of unique(targetRoles).slice(0, 6)) {
    evidence.push({ id: slugId("role", role), kind: "ROLE", label: role, strength: "MODERATE" });
  }
  for (const item of unique(education).slice(0, 4)) {
    evidence.push({ id: slugId("edu", item), kind: "EDUCATION", label: item, strength: "STRONG" });
  }
  for (const item of unique(certifications).slice(0, 4)) {
    evidence.push({ id: slugId("cert", item), kind: "CERTIFICATION", label: item, strength: "STRONG" });
  }
  for (const item of unique(workHistory).slice(0, 6)) {
    evidence.push({ id: slugId("work", item), kind: "WORK_HISTORY", label: item, strength: "MODERATE" });
  }
  for (const pattern of jobRequirementPatterns.slice(0, 8)) {
    evidence.push({
      id: slugId("req", pattern.name),
      kind: "JOB_PATTERN",
      label: pattern.name,
      detail: `Appeared in ${pattern.count} target-job requirement${pattern.count === 1 ? "" : "s"}.`,
      strength: pattern.count >= 3 ? "STRONG" : "MODERATE",
    });
  }

  const warnings = [];
  if (evidence.length === 0) {
    warnings.push({
      code: "thin_evidence",
      message: "CareerOS has limited verified evidence. Strategy will stay conservative.",
    });
  }

  const raw: LinkedinCareerContext = {
    targetRoles: unique(targetRoles),
    verifiedSkills: unique(verifiedSkills),
    projects: unique(projects),
    education: unique(education),
    workHistory: unique(workHistory),
    certifications: unique(certifications),
    resumeSummary: content?.summary || resumeAnalysis?.profileSummary || null,
    careerHeadline: brief?.headline ?? resumeAnalysis?.detectedRole ?? null,
    jobRequirementPatterns,
    recentApplicationPatterns,
    professionalThemes: unique([
      ...asStringArray(skills?.prioritySkills, 8),
      ...unique(verifiedSkills).slice(0, 6),
    ]),
    evidence,
    warnings,
    fingerprint: "",
  };

  const sanitized = sanitizeLinkedinCareerContext(raw);
  sanitized.fingerprint = sha1Fingerprint(
    JSON.stringify({
      roles: sanitized.targetRoles,
      skills: sanitized.verifiedSkills,
      projects: sanitized.projects,
      requirements: sanitized.jobRequirementPatterns,
    }),
  );
  return sanitized;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
