import { prisma } from "@/server/db/prisma";

import { MAX_JOBS_LIST } from "../constants";
import { loadCanonicalProfile, projectSavedJobAnalysis } from "../matching/stamp-job-match";
import { mapJobPostingToListItem } from "./map-job-posting-to-view";
import type { JobListItem } from "../types";

export async function getJobPostingsForUser(userId: string): Promise<JobListItem[]> {
  const [jobs, profile] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_JOBS_LIST,
      include: { analysis: true },
    }),
    loadCanonicalProfile(userId),
  ]);

  return jobs.map((job) => mapJobPostingToListItem(projectSavedJobAnalysis(job, profile)));
}
