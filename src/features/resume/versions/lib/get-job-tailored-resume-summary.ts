import { prisma } from "@/server/db/prisma";

import type { JobTailoredResumeSummary } from "../types";
import { getResumeVersionForJob } from "./get-resume-version-for-job";

/**
 * Job-detail view of tailored resumes for one job.
 * Archived versions are never returned as the primary result.
 */
export async function getJobTailoredResumeSummary(
  userId: string,
  jobId: string,
): Promise<JobTailoredResumeSummary> {
  const [primary, archivedCount] = await Promise.all([
    getResumeVersionForJob(userId, jobId),
    prisma.resumeVersion.count({
      where: { userId, targetJobId: jobId, status: "ARCHIVED" },
    }),
  ]);

  if (!primary) {
    return { primary: null, archivedCount };
  }

  return {
    primary: {
      id: primary.id,
      title: primary.title,
      status: primary.status,
      activeRevisionId: primary.activeRevisionId,
      activeRevisionNumber: primary.activeRevision?.revisionNumber ?? null,
      activeRevisionSource: primary.activeRevision?.source ?? null,
      alignmentScoreAfter: primary.alignmentScoreAfter,
      updatedAt: primary.updatedAt.toISOString(),
    },
    archivedCount,
  };
}
