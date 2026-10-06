import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DiscoveryPage } from "@/features/jobs/discovery/components/discovery-page";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { getDiscoveryResumeInput } from "@/features/jobs/discovery/lib/run-job-discovery";
import {
  getDiscoveryResultsForUser,
  getLastDiscoveryRun,
  getTodayStrongCount,
} from "@/features/jobs/discovery/lib/get-discovery-results";
import { getProviderStatus } from "@/features/jobs/discovery/providers/registry";
import { auth } from "@/server/auth";

export default async function WorkspaceJobsDiscoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const userId = session.user.id;
  const profile = await getDiscoveryProfileForUser(userId);
  const minScore = profile?.minimumSuitabilityScore ?? 75;
  const dailyTarget = profile?.dailyTarget ?? 20;

  const [results, lastRun, todayStrong, providerStatus, resumeInput] = await Promise.all([
    getDiscoveryResultsForUser(userId, { filter: "all", minimumScore: minScore }),
    getLastDiscoveryRun(userId),
    getTodayStrongCount(userId, minScore),
    Promise.resolve(getProviderStatus()),
    getDiscoveryResumeInput(userId),
  ]);

  return (
    <DiscoveryPage
      profile={profile ? { ...profile, id: profile.id } : null}
      resumeContext={{
        status: resumeInput.status,
        sourceFilename: resumeInput.sourceFilename,
        revisionNumber: resumeInput.revisionNumber,
      }}
      results={results}
      providerStatus={providerStatus}
      lastRun={
        lastRun
          ? {
              startedAt: lastRun.startedAt.toISOString(),
              status: lastRun.status,
              strongMatchCount: lastRun.strongMatchCount,
              providerErrors: Array.isArray(lastRun.providerErrorsJson)
                ? (lastRun.providerErrorsJson as {
                    provider: "REMOTIVE" | "ARBEITNOW" | "ADZUNA" | "JOOBLE";
                    category:
                      | "NOT_CONFIGURED"
                      | "TIMEOUT"
                      | "RATE_LIMITED"
                      | "AUTH_FAILED"
                      | "NETWORK_ERROR"
                      | "INVALID_RESPONSE"
                      | "UNKNOWN";
                    message: string;
                  }[])
                : [],
              diagnostics: diagnosticsFromSnapshot(lastRun.querySnapshotJson),
              providerStats: Array.isArray(lastRun.providerStatsJson)
                ? lastRun.providerStatsJson as { provider: string; status: string; rawResults?: number; boardsQueried?: number }[]
                : [],
            }
          : null
      }
      todayStrong={todayStrong}
      dailyTarget={dailyTarget}
    />
  );
}

function diagnosticsFromSnapshot(value: unknown) {
  if (typeof value !== "object" || value === null || !("filterStats" in value)) return null;
  const stats = (value as { filterStats?: unknown }).filterStats;
  if (typeof stats !== "object" || stats === null) return null;
  return stats as {
    fetched: number;
    normalized: number;
    duplicatesRemoved: number;
    roleFiltered: number;
    seniorityFiltered: number;
    stackFiltered: number;
    employmentFiltered: number;
    geoFiltered: number;
    freshnessFiltered: number;
    trustFiltered: number;
    kept: number;
    locationIncomplete: boolean;
  };
}
