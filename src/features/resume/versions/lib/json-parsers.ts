import type { Prisma } from "@/generated/prisma/client";

import { EMPTY_RESUME_VERSION_CONTENT, EMPTY_RESUME_VERSION_INPUT_SNAPSHOT } from "../types";
import type {
  ResumeVersionChangeLogItem,
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionInputSnapshot,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionWarning,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function parseResumeVersionContent(value: unknown): ResumeVersionContent {
  if (!isRecord(value)) {
    return { ...EMPTY_RESUME_VERSION_CONTENT };
  }

  return {
    summary: typeof value.summary === "string" ? value.summary : "",
    coreSkills: asStringArray(value.coreSkills),
    technicalSkills: Array.isArray(value.technicalSkills)
      ? value.technicalSkills
          .filter(isRecord)
          .map((item) => ({
            category: typeof item.category === "string" ? item.category : "",
            skills: asStringArray(item.skills),
          }))
          .filter((item) => item.category.length > 0 || item.skills.length > 0)
      : [],
    experienceBullets: Array.isArray(value.experienceBullets)
      ? (value.experienceBullets as ResumeVersionContent["experienceBullets"])
      : [],
    projects: Array.isArray(value.projects)
      ? (value.projects as ResumeVersionContent["projects"])
      : [],
    education: asStringArray(value.education),
    certifications: asStringArray(value.certifications),
  };
}

export function parseKeywordCoverage(value: unknown): ResumeVersionKeywordCoverageItem[] {
  return Array.isArray(value) ? (value as ResumeVersionKeywordCoverageItem[]) : [];
}

export function parseWarnings(value: unknown): ResumeVersionWarning[] {
  return Array.isArray(value) ? (value as ResumeVersionWarning[]) : [];
}

export function parseChangeLog(value: unknown): ResumeVersionChangeLogItem[] {
  return Array.isArray(value) ? (value as ResumeVersionChangeLogItem[]) : [];
}

export function parseEvidenceNotes(value: unknown): ResumeVersionEvidenceNote[] {
  return Array.isArray(value) ? (value as ResumeVersionEvidenceNote[]) : [];
}

export function parseInputSnapshot(value: unknown): ResumeVersionInputSnapshot {
  if (!isRecord(value)) {
    return { ...EMPTY_RESUME_VERSION_INPUT_SNAPSHOT };
  }

  return {
    resumeDocumentId:
      typeof value.resumeDocumentId === "string" || value.resumeDocumentId === null
        ? (value.resumeDocumentId as string | null)
        : null,
    resumeAnalysisId:
      typeof value.resumeAnalysisId === "string" || value.resumeAnalysisId === null
        ? (value.resumeAnalysisId as string | null)
        : null,
    targetJobId:
      typeof value.targetJobId === "string" || value.targetJobId === null
        ? (value.targetJobId as string | null)
        : null,
    targetJobAnalysisId:
      typeof value.targetJobAnalysisId === "string" || value.targetJobAnalysisId === null
        ? (value.targetJobAnalysisId as string | null)
        : null,
    jobTitle:
      typeof value.jobTitle === "string" || value.jobTitle === null
        ? (value.jobTitle as string | null)
        : null,
    company:
      typeof value.company === "string" || value.company === null
        ? (value.company as string | null)
        : null,
    matchScore:
      typeof value.matchScore === "number" || value.matchScore === null
        ? (value.matchScore as number | null)
        : null,
    topSkillGaps: asStringArray(value.topSkillGaps),
    nonSkillBlockers: asStringArray(value.nonSkillBlockers),
  };
}
