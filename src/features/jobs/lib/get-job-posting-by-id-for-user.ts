import { prisma } from "@/server/db/prisma";

import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import type { JobDetailView } from "../types";

export async function getJobPostingByIdForUser(
  userId: string,
  jobId: string,
): Promise<JobDetailView | null> {
  const job = await prisma.jobPosting.findFirst({
    where: {
      id: jobId,
      userId,
    },
    include: { analysis: true },
  });

  if (!job) return null;
  return mapJobPostingToDetailView(job);
}
