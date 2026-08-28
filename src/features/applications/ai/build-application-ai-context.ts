import { prisma } from "@/server/db/prisma";

import type {
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionKeywordCoverageItem,
} from "@/features/resume/versions/types";

import { parseApplicationDocuments, parseApplicationSnapshot } from "../lib/json-parsers";
import type { ApplicationAiContext, ApplicationAiResumeContext } from "./types";

const DESCRIPTION_LIMIT = 3_000;
const TIMELINE_LIMIT = 12;
const LIST_LIMIT = 12;
const NOTE_LIMIT = 1_200;

const EMPTY_RESUME_CONTEXT: ApplicationAiResumeContext = {
  resumeVersionTitle: null,
  revisionNumber: null,
  alignmentScoreAfter: null,
  summary: null,
  coreSkills: [],
  experienceBullets: [],
  projects: [],
  unsupportedKeywords: [],
  supportedEvidence: [],
  available: false,
};

function truncate(value: string | null, limit: number): string | null {
  if (!value) return null;
  return value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Assembles the deliberate, controlled context object given to the model.
 *
 * Prisma rows are never serialized directly. Everything here is an explicit
 * projection of stored CareerOS evidence, which is also what makes the
 * fingerprint stable enough to cache against.
 */
export async function buildApplicationAiContext(
  userId: string,
  applicationId: string,
): Promise<ApplicationAiContext | null> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      followUpAt: true,
      notes: true,
      companyNotes: true,
      documentsNeededJson: true,
      confirmedRejectionReason: true,
      confirmedRejectionSource: true,
      contextSnapshotJson: true,
      resumeVersionRevisionId: true,
      resumeVersion: { select: { title: true } },
      resumeVersionRevision: {
        select: {
          revisionNumber: true,
          alignmentScoreAfter: true,
          contentJson: true,
          keywordCoverageJson: true,
          evidenceNotesJson: true,
        },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 6,
        select: { name: true, role: true },
      },
      events: {
        orderBy: { eventAt: "desc" },
        take: TIMELINE_LIMIT,
        select: { type: true, title: true, eventAt: true },
      },
    },
  });

  if (!application) return null;

  const snapshot = parseApplicationSnapshot(application.contextSnapshotJson);
  const now = new Date();

  let resume: ApplicationAiResumeContext = { ...EMPTY_RESUME_CONTEXT };

  if (application.resumeVersionRevision) {
    const revision = application.resumeVersionRevision;
    const content = revision.contentJson as ResumeVersionContent | null;
    const keywords = Array.isArray(revision.keywordCoverageJson)
      ? (revision.keywordCoverageJson as ResumeVersionKeywordCoverageItem[])
      : [];
    const evidence = Array.isArray(revision.evidenceNotesJson)
      ? (revision.evidenceNotesJson as ResumeVersionEvidenceNote[])
      : [];

    resume = {
      resumeVersionTitle: application.resumeVersion?.title ?? snapshot.resume.resumeVersionTitle,
      revisionNumber: revision.revisionNumber,
      alignmentScoreAfter: revision.alignmentScoreAfter,
      summary: truncate(content?.summary ?? null, 900),
      coreSkills: (content?.coreSkills ?? []).slice(0, LIST_LIMIT),
      experienceBullets: (content?.experienceBullets ?? [])
        .map((bullet) => bullet.tailored)
        .filter((text): text is string => typeof text === "string" && text.length > 0)
        .slice(0, LIST_LIMIT),
      projects: (content?.projects ?? [])
        .map((project) => project.tailored)
        .filter((text): text is string => typeof text === "string" && text.length > 0)
        .slice(0, 6),
      unsupportedKeywords: keywords
        .filter((item) => item.evidenceStrength === "none" || item.evidenceStrength === "weak")
        .map((item) => item.keyword)
        .slice(0, LIST_LIMIT),
      supportedEvidence: evidence
        .filter((note) => note.safeToUse)
        .map((note) => `${note.claim}: ${note.evidence}`)
        .slice(0, LIST_LIMIT),
      available: true,
    };
  } else if (snapshot.resume.resumeVersionRevisionId) {
    // The resume record is gone but the submission snapshot survives.
    resume = {
      ...EMPTY_RESUME_CONTEXT,
      resumeVersionTitle: snapshot.resume.resumeVersionTitle,
      revisionNumber: snapshot.resume.revisionNumber,
      alignmentScoreAfter: snapshot.resume.alignmentScoreAfter,
    };
  }

  const description = snapshot.job.description;

  return {
    applicationId: application.id,
    status: application.status,
    appliedAt: application.appliedAt?.toISOString() ?? null,
    followUpAt: application.followUpAt?.toISOString() ?? null,
    daysSinceApplied: application.appliedAt ? daysBetween(application.appliedAt, now) : null,
    job: {
      title: snapshot.job.title,
      company: snapshot.job.company,
      location: snapshot.job.location,
      description: truncate(description, DESCRIPTION_LIMIT),
      descriptionTruncated: (description?.length ?? 0) > DESCRIPTION_LIMIT,
      matchScore: snapshot.jobAnalysis.matchScore,
      roleAlignment: snapshot.jobAnalysis.roleAlignment,
      matchedSkills: snapshot.jobAnalysis.matchedSkills.slice(0, LIST_LIMIT),
      missingSkills: snapshot.jobAnalysis.missingSkills.slice(0, LIST_LIMIT),
    },
    resume,
    timeline: application.events.map((event) => ({
      type: event.type,
      title: event.title,
      eventAt: event.eventAt.toISOString(),
    })),
    contacts: application.contacts.map((contact) => ({
      name: contact.name,
      role: contact.role,
    })),
    notes: truncate(application.notes, NOTE_LIMIT),
    companyNotes: truncate(application.companyNotes, NOTE_LIMIT),
    documents: parseApplicationDocuments(application.documentsNeededJson),
    confirmedRejectionReason: application.confirmedRejectionReason,
    confirmedRejectionSource: application.confirmedRejectionSource,
    upcomingEventAt:
      application.events
        .filter((event) => event.eventAt >= now)
        .sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime())[0]
        ?.eventAt.toISOString() ?? null,
  };
}
