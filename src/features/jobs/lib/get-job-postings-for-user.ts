import { prisma } from "@/server/db/prisma";

import { MAX_JOBS_LIST } from "../constants";
import { mapJobPostingToListItem } from "./map-job-posting-to-view";
import type { JobListItem } from "../types";

export async function getJobPostingsForUser(userId: string): Promise<JobListItem[]> {
  const jobs = await prisma.jobPosting.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_JOBS_LIST,
    include: { analysis: true },
  });

  return jobs.map(mapJobPostingToListItem);
}
