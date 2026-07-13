import { prisma } from "@/server/db/prisma";

import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import type { JobDetailView, UpdateJobApplicationInput } from "../types";

export async function updateJobApplicationForUser(
  userId: string,
  jobId: string,
  input: UpdateJobApplicationInput,
): Promise<JobDetailView | null> {
  const existing = await prisma.jobPosting.findFirst({
    where: { id: jobId, userId },
    include: { analysis: true },
  });

  if (!existing) return null;

  let appliedAt = existing.appliedAt;

  if (input.applicationStatus === "applied") {
    if (input.appliedAt !== undefined) {
      appliedAt = input.appliedAt;
    } else if (!appliedAt) {
      appliedAt = new Date();
    }
  } else if (input.appliedAt !== undefined) {
    appliedAt = input.appliedAt;
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      applicationStatus: input.applicationStatus,
      ...(input.applicationNotes !== undefined
        ? { applicationNotes: input.applicationNotes }
        : {}),
      appliedAt,
    },
    include: { analysis: true },
  });

  return mapJobPostingToDetailView(updated);
}
