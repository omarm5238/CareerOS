import { getWorkspaceJobsStatusForUser } from "@/features/jobs/server";
import { getSafeLinkedinConnection } from "@/features/linkedin/server";
import { getResumeAnalysisHistoryForUser } from "@/features/resume/server";
import { getLinkedinProviderMode } from "@/features/linkedin/integration/config";
import { isAiConfigured } from "@/server/ai/client";

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
  const [profile, accountSummary, connection] = await Promise.all([
    getUserProfile(userId),
    getAccountSummary(userId),
    getSafeLinkedinConnection(userId),
  ]);

  if (!profile) return null;

  const publish = connection.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST");
  return {
    profile,
    accountSummary,
    providerStatus: {
      aiConfigured: isAiConfigured(),
      linkedinMode: getLinkedinProviderMode(),
      linkedinStatus: connection.status,
      linkedinPublishAvailable: publish?.state === "AVAILABLE",
    },
  };
}
