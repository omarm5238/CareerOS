import type { Prisma } from "@/generated/prisma/client";

import {
  APPLICATION_DOCUMENT_SOURCES,
  APPLICATION_DOCUMENT_STATUSES,
  EMPTY_APPLICATION_SNAPSHOT,
} from "../types";
import type {
  ApplicationContextSnapshot,
  ApplicationDocumentItem,
  ApplicationDocumentSource,
  ApplicationDocumentStatus,
  ApplicationEventMetadata,
} from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function parseApplicationSnapshot(value: unknown): ApplicationContextSnapshot {
  if (!isRecord(value)) {
    return structuredClone(EMPTY_APPLICATION_SNAPSHOT);
  }

  const job = isRecord(value.job) ? value.job : {};
  const jobAnalysis = isRecord(value.jobAnalysis) ? value.jobAnalysis : {};
  const resume = isRecord(value.resume) ? value.resume : {};

  return {
    job: {
      jobPostingId: asString(job.jobPostingId),
      title: asString(job.title),
      company: asString(job.company),
      location: asString(job.location),
      jobUrl: asString(job.jobUrl),
      source: asString(job.source),
      description: asString(job.description),
    },
    jobAnalysis: {
      jobAnalysisId: asString(jobAnalysis.jobAnalysisId),
      matchScore: asNumber(jobAnalysis.matchScore),
      roleAlignment: asString(jobAnalysis.roleAlignment),
      matchedSkills: asStringArray(jobAnalysis.matchedSkills),
      missingSkills: asStringArray(jobAnalysis.missingSkills),
    },
    resume: {
      resumeVersionId: asString(resume.resumeVersionId),
      resumeVersionTitle: asString(resume.resumeVersionTitle),
      resumeVersionRevisionId: asString(resume.resumeVersionRevisionId),
      revisionNumber: asNumber(resume.revisionNumber),
      alignmentScoreBefore: asNumber(resume.alignmentScoreBefore),
      alignmentScoreAfter: asNumber(resume.alignmentScoreAfter),
    },
    submittedAt: asString(value.submittedAt),
  };
}

export function parseApplicationDocuments(value: unknown): ApplicationDocumentItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      label: (asString(item.label) ?? "").trim(),
      status: asEnum<ApplicationDocumentStatus>(
        item.status,
        APPLICATION_DOCUMENT_STATUSES,
        "needed",
      ),
      source: asEnum<ApplicationDocumentSource>(
        item.source,
        APPLICATION_DOCUMENT_SOURCES,
        "USER_ADDED",
      ),
      ...(asString(item.note) ? { note: (asString(item.note) as string).trim() } : {}),
    }))
    .filter((item) => item.label.length > 0)
    .slice(0, 20);
}

export function parseApplicationEventMetadata(value: unknown): ApplicationEventMetadata {
  if (!isRecord(value)) return {};

  const metadata: ApplicationEventMetadata = {};
  const round = asString(value.round);
  const format = asString(value.format);
  const url = asString(value.url);
  const location = asString(value.location);
  const notes = asString(value.notes);

  if (round) metadata.round = round;
  if (format) metadata.format = format;
  if (url) metadata.url = url;
  if (location) metadata.location = location;
  if (notes) metadata.notes = notes;

  return metadata;
}

export function parseInsightWarnings(value: unknown): string[] {
  return asStringArray(value).slice(0, 12);
}
