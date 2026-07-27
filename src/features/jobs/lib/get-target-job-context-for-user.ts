import { prisma } from "@/server/db/prisma";

import type { TargetJobContext } from "../types/target-job-context";
import { getJobPostingByIdForUser } from "./get-job-posting-by-id-for-user";
import { getJobPostingsForUser } from "./get-job-postings-for-user";

export async function getTargetJobContextForUser(
  userId: string,
  requestedJobId?: string | null,
): Promise<TargetJobContext> {
  const [savedJobsCount, availableJobs] = await Promise.all([
    prisma.jobPosting.count({ where: { userId } }),
    getJobPostingsForUser(userId),
  ]);

  if (savedJobsCount === 0) {
    return {
      savedJobsCount: 0,
      selectedJobId: null,
      selectedJob: null,
      selectedJobTitle: null,
      selectedJobCompany: null,
      selectedJobCreatedAt: null,
      hasSelectedJob: false,
      hasJobs: false,
      mode: "none",
      availableJobs: [],
    };
  }

  const requested = requestedJobId?.trim()
    ? await getJobPostingByIdForUser(userId, requestedJobId.trim())
    : null;
  const latestId = availableJobs[0]?.id ?? null;
  const fallbackLatest =
    latestId ? await getJobPostingByIdForUser(userId, latestId) : null;

  // Explicit jobId → selected-job mode only when the job is owned.
  // No jobId → all-jobs aggregate mode (latest kept only for switcher convenience).
  if (requested) {
    return {
      savedJobsCount,
      selectedJobId: requested.id,
      selectedJob: requested,
      selectedJobTitle: requested.title,
      selectedJobCompany: requested.company,
      selectedJobCreatedAt: requested.createdAt,
      hasSelectedJob: true,
      hasJobs: true,
      mode: "selected_job",
      availableJobs,
    };
  }

  return {
    savedJobsCount,
    selectedJobId: null,
    selectedJob: fallbackLatest,
    selectedJobTitle: null,
    selectedJobCompany: null,
    selectedJobCreatedAt: null,
    hasSelectedJob: false,
    hasJobs: true,
    mode: "all_jobs",
    availableJobs,
  };
}
