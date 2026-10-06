import { prisma } from "@/server/db/prisma";

import { loadCanonicalProfile, projectSavedJobAnalysis } from "../matching/stamp-job-match";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import type { JobDetailView } from "../types";

export async function getJobPostingByIdForUser(
  userId: string,
  jobId: string,
): Promise<JobDetailView | null> {
  const [job, profile] = await Promise.all([
    prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        userId,
      },
      include: { analysis: true },
    }),
    loadCanonicalProfile(userId),
  ]);

  if (!job) return null;
  return mapJobPostingToDetailView(projectSavedJobAnalysis(job, profile));
}
