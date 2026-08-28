import { prisma } from "@/server/db/prisma";

import { EMPTY_APPLICATION_SNAPSHOT } from "../types";
import type { ApplicationContextSnapshot } from "../types";

const SNAPSHOT_DESCRIPTION_LIMIT = 4_000;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 30);
}

type BuildApplicationSnapshotInput = {
  userId: string;
  jobPostingId?: string | null;
  resumeVersionId?: string | null;
  resumeVersionRevisionId?: string | null;
  /** Carried forward so a re-built snapshot never loses submission provenance. */
  submittedAt?: string | null;
};

/**
 * Builds the historical context snapshot for an application. The snapshot is the
 * safety net that keeps an application readable after its job or resume is gone.
 */
export async function buildApplicationSnapshot(
  input: BuildApplicationSnapshotInput,
): Promise<ApplicationContextSnapshot> {
  const snapshot: ApplicationContextSnapshot = structuredClone(EMPTY_APPLICATION_SNAPSHOT);
  snapshot.submittedAt = input.submittedAt ?? null;

  if (input.jobPostingId) {
    const job = await prisma.jobPosting.findFirst({
      where: { id: input.jobPostingId, userId: input.userId },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        jobUrl: true,
        source: true,
        description: true,
        analysis: {
          select: {
            id: true,
            matchScore: true,
            roleAlignment: true,
            matchedSkills: true,
            missingSkills: true,
          },
        },
      },
    });

    if (job) {
      snapshot.job = {
        jobPostingId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        jobUrl: job.jobUrl,
        source: job.source,
        description: job.description.slice(0, SNAPSHOT_DESCRIPTION_LIMIT),
      };

      if (job.analysis) {
        snapshot.jobAnalysis = {
          jobAnalysisId: job.analysis.id,
          matchScore: job.analysis.matchScore,
          roleAlignment: job.analysis.roleAlignment,
          matchedSkills: asStringArray(job.analysis.matchedSkills),
          missingSkills: asStringArray(job.analysis.missingSkills),
        };
      }
    }
  }

  if (input.resumeVersionId) {
    const version = await prisma.resumeVersion.findFirst({
      where: { id: input.resumeVersionId, userId: input.userId },
      select: { id: true, title: true },
    });

    if (version) {
      snapshot.resume.resumeVersionId = version.id;
      snapshot.resume.resumeVersionTitle = version.title;
    }
  }

  if (input.resumeVersionRevisionId) {
    const revision = await prisma.resumeVersionRevision.findFirst({
      where: { id: input.resumeVersionRevisionId, userId: input.userId },
      select: {
        id: true,
        revisionNumber: true,
        alignmentScoreBefore: true,
        alignmentScoreAfter: true,
      },
    });

    if (revision) {
      snapshot.resume.resumeVersionRevisionId = revision.id;
      snapshot.resume.revisionNumber = revision.revisionNumber;
      snapshot.resume.alignmentScoreBefore = revision.alignmentScoreBefore;
      snapshot.resume.alignmentScoreAfter = revision.alignmentScoreAfter;
    }
  }

  return snapshot;
}
