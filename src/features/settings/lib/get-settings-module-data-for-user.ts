import { getWorkspaceJobsStatusForUser } from "@/features/jobs/server";
import { getResumeAnalysisHistoryForUser } from "@/features/resume/server";

import { getUserProfile } from "./get-user-profile";
import type { AccountSummary, SettingsModuleData } from "../types";

function buildApplicationSummary(appliedCount: number, savedJobsCount: number): string {
  if (savedJobsCount === 0) return "No saved jobs";
  if (appliedCount === 0) return `${savedJobsCount} saved · none applied yet`;
  return `${appliedCount} applied of ${savedJobsCount} saved`;
}

async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const [history, jobsStatus] = await Promise.all([
    getResumeAnalysisHistoryForUser(userId),
    getWorkspaceJobsStatusForUser(userId),
  ]);

  return {
    resumeAnalysesCount: history.length,
    savedJobsCount: jobsStatus.count,
    appliedJobsCount: jobsStatus.appliedCount,
    applicationSummary: buildApplicationSummary(
      jobsStatus.appliedCount,
      jobsStatus.count,
    ),
  };
}

export async function getSettingsModuleDataForUser(
  userId: string,
): Promise<SettingsModuleData | null> {
  const [profile, accountSummary] = await Promise.all([
    getUserProfile(userId),
    getAccountSummary(userId),
  ]);

  if (!profile) return null;

  return { profile, accountSummary };
}
