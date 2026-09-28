import { MAX_RAW_JOBS_PER_RUN } from "../constants";
import type { ProviderError, ProviderJobResult, ProviderRunStats } from "../types";
import type { SearchIntent } from "../quality/search-quality";
import { ProviderRequestError } from "./http";
import { planProviderSearch } from "./query-planner";
import type { ProviderSearchReport } from "./search-report";
import type { JobDiscoveryProvider } from "./types";

type ReportingProvider = JobDiscoveryProvider & {
  takeSearchReport?: () => ProviderSearchReport | null;
};

export async function executeProviderSearches(input: {
  providers: JobDiscoveryProvider[];
  enabled: JobDiscoveryProvider[];
  intent: SearchIntent;
  remoteWanted: boolean;
}): Promise<{ results: ProviderJobResult[]; stats: ProviderRunStats[]; errors: ProviderError[]; anySuccess: boolean }> {
  const results: ProviderJobResult[] = [];
  const stats: ProviderRunStats[] = [];
  const errors: ProviderError[] = [];
  let anySuccess = false;

  for (const provider of input.providers) {
    if (!provider.isConfigured()) {
      stats.push({ provider: provider.provider, configured: false, requestsMade: 0, rawResults: 0, normalizedResults: 0, durationMs: 0, status: "skipped" });
      continue;
    }
    if (!input.enabled.some((item) => item.provider === provider.provider)) continue;
    const plan = planProviderSearch(provider.provider, input.intent, input.remoteWanted);
    if (!plan.execute) {
      stats.push({
        provider: provider.provider,
        configured: true,
        requestsMade: 0,
        rawResults: 0,
        normalizedResults: 0,
        durationMs: 0,
        status: plan.reason === "unsupported_target" ? "unsupported_target" : "skipped",
      });
      continue;
    }

    const started = Date.now();
    try {
      const jobs = await provider.search({
        keywords: plan.keywords,
        countryCode: plan.countries[0],
        countryCodes: plan.countries,
      });
      const room = MAX_RAW_JOBS_PER_RUN - results.length;
      const accepted = room > 0 ? jobs.slice(0, room) : [];
      results.push(...accepted);
      const report = (provider as ReportingProvider).takeSearchReport?.() ?? null;
      const status = report?.status === "partial" || report?.status === "rate_limited" || report?.status === "failed"
        ? report.status
        : "success";
      stats.push({
        provider: provider.provider,
        configured: true,
        requestsMade: report?.requestsMade ?? 1,
        rawResults: jobs.length,
        normalizedResults: accepted.length,
        durationMs: Date.now() - started,
        status,
        boardsQueried: report?.boardsQueried,
        invalidRemoved: report?.invalidRemoved,
      });
      if (status === "rate_limited") {
        errors.push({ provider: provider.provider, category: "RATE_LIMITED", message: "Provider rate limited the request" });
      } else if (status === "success" || status === "partial") {
        anySuccess = true;
      }
    } catch (error) {
      const category = error instanceof ProviderRequestError ? error.category : "UNKNOWN";
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ provider: provider.provider, category, message: message.slice(0, 200) });
      stats.push({
        provider: provider.provider,
        configured: true,
        requestsMade: 1,
        rawResults: 0,
        normalizedResults: 0,
        durationMs: Date.now() - started,
        status: category === "RATE_LIMITED" ? "rate_limited" : "failed",
      });
    }
  }

  return { results, stats, errors, anySuccess };
}
