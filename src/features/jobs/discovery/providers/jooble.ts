import { PROVIDER_TIMEOUT_MS, MAX_RESULTS_PER_PROVIDER, JOOBLE_REGIONAL_ENDPOINTS } from "../constants";
import type { ProviderJobResult, ProviderSearchRequest, ProviderAttribution } from "../types";
import type { JobDiscoveryProvider } from "./types";

function getConfiguredRegions(): { region: string; key: string; endpoint: string }[] {
  const regions: { region: string; key: string; endpoint: string }[] = [];
  for (const [region, endpoint] of Object.entries(JOOBLE_REGIONAL_ENDPOINTS)) {
    const envKey = `JOOBLE_API_KEY_${region}`;
    const key = process.env[envKey]?.trim();
    if (key) regions.push({ region, key, endpoint });
  }
  return regions;
}

function parseJoobleJob(raw: Record<string, unknown>, region: string): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const company = typeof raw.company === "string" ? raw.company.trim() : "";
  if (!title || !company) return null;

  const desc = typeof raw.snippet === "string" ? raw.snippet : "";
  const location = typeof raw.location === "string" ? raw.location.trim() : null;
  const sourceUrl = typeof raw.link === "string" ? raw.link : "";
  if (!sourceUrl) return null;

  const updated = typeof raw.updated === "string" ? raw.updated : null;

  return {
    provider: "JOOBLE",
    externalId: typeof raw.id === "string" ? raw.id : null,
    title,
    company,
    location,
    countryCode: region,
    workMode: "UNKNOWN",
    employmentType: typeof raw.type === "string" && raw.type.includes("Part") ? "PART_TIME" : "UNKNOWN",
    description: desc,
    salaryText: typeof raw.salary === "string" && raw.salary.trim() ? raw.salary.trim() : null,
    postedAt: updated,
    expiresAt: null,
    sourceUrl,
    applyUrl: sourceUrl,
    remote: null,
    visaSponsorship: null,
    sourceMetadata: { region },
  };
}

export class JoobleProvider implements JobDiscoveryProvider {
  provider = "JOOBLE" as const;

  isConfigured(): boolean {
    return getConfiguredRegions().length > 0;
  }

  getStatus(): "available" | "not_configured" | "unavailable" {
    return this.isConfigured() ? "available" : "not_configured";
  }

  async search(request: ProviderSearchRequest): Promise<ProviderJobResult[]> {
    const regions = getConfiguredRegions();
    if (regions.length === 0) return [];

    // Only search in the first configured region to be conservative
    const { key, endpoint, region } = regions[0];
    const results: ProviderJobResult[] = [];
    const query = request.keywords.join(" ") || "software engineer";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch(`${endpoint}${key}`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: query,
          location: request.location || "",
          page: 1,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json() as { jobs?: unknown[] };
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      for (const raw of jobs) {
        if (typeof raw !== "object" || raw === null) continue;
        const parsed = parseJoobleJob(raw as Record<string, unknown>, region);
        if (parsed) results.push(parsed);
        if (results.length >= MAX_RESULTS_PER_PROVIDER) break;
      }
    } catch {
      // Failure isolated
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }

  getAttribution(job: ProviderJobResult): ProviderAttribution {
    return {
      provider: "JOOBLE",
      providerLabel: "Jooble",
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    };
  }
}
