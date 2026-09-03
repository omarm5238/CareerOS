import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DiscoveryPage } from "@/features/jobs/discovery/components/discovery-page";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
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

  const [results, lastRun, todayStrong, providerStatus] = await Promise.all([
    getDiscoveryResultsForUser(userId, { filter: "all", minimumScore: minScore }),
    getLastDiscoveryRun(userId),
    getTodayStrongCount(userId, minScore),
    Promise.resolve(getProviderStatus()),
  ]);

  return (
    <DiscoveryPage
      profile={profile ? { ...profile, id: profile.id } : null}
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
            }
          : null
      }
      todayStrong={todayStrong}
      dailyTarget={dailyTarget}
    />
  );
}
