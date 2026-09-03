import { PROVIDER_TIMEOUT_MS, MAX_RESULTS_PER_PROVIDER, ADZUNA_SUPPORTED_COUNTRIES } from "../constants";
import type { ProviderJobResult, ProviderSearchRequest, ProviderAttribution } from "../types";
import type { JobDiscoveryProvider } from "./types";

function parseAdzunaJob(raw: Record<string, unknown>, country: string): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const company = typeof (raw.company as Record<string, unknown>)?.display_name === "string"
    ? ((raw.company as Record<string, unknown>).display_name as string).trim() : "";
  if (!title || !company) return null;

  const desc = typeof raw.description === "string" ? raw.description : "";
  const loc = typeof (raw.location as Record<string, unknown>)?.display_name === "string"
    ? ((raw.location as Record<string, unknown>).display_name as string).trim() : null;

  const sourceUrl = typeof raw.redirect_url === "string" ? raw.redirect_url : "";
  if (!sourceUrl) return null;

  let salaryText: string | null = null;
  const salaryMin = typeof raw.salary_min === "number" ? raw.salary_min : null;
  const salaryMax = typeof raw.salary_max === "number" ? raw.salary_max : null;
  if (salaryMin != null && salaryMax != null) salaryText = `${salaryMin} - ${salaryMax}`;
  else if (salaryMin != null) salaryText = `From ${salaryMin}`;
  else if (salaryMax != null) salaryText = `Up to ${salaryMax}`;

  const createdAt = typeof raw.created === "string" ? raw.created : null;

  return {
    provider: "ADZUNA",
    externalId: raw.id != null ? String(raw.id) : null,
    title,
    company,
    location: loc,
    countryCode: country.toUpperCase(),
    workMode: "UNKNOWN",
    employmentType: typeof raw.contract_time === "string" && raw.contract_time.includes("part") ? "PART_TIME" : "FULL_TIME",
    description: desc,
    salaryText,
    postedAt: createdAt,
    expiresAt: null,
    sourceUrl,
    applyUrl: sourceUrl,
    remote: null,
    visaSponsorship: null,
    sourceMetadata: {
      category: (raw.category as Record<string, unknown>)?.label ?? null,
    },
  };
}

export class AdzunaProvider implements JobDiscoveryProvider {
  provider = "ADZUNA" as const;

  private getCredentials() {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_APP_KEY?.trim();
    return appId && appKey ? { appId, appKey } : null;
  }

  isConfigured(): boolean {
    return this.getCredentials() !== null;
  }

  getStatus(): "available" | "not_configured" | "unavailable" {
    return this.isConfigured() ? "available" : "not_configured";
  }

  async search(request: ProviderSearchRequest): Promise<ProviderJobResult[]> {
    const creds = this.getCredentials();
    if (!creds) return [];

    const country = (request.countryCode?.toLowerCase() ?? "gb");
    if (!ADZUNA_SUPPORTED_COUNTRIES[country]) return [];

    const results: ProviderJobResult[] = [];
    const keywords = request.keywords.slice(0, 3);
    const query = keywords.join(" ") || "software engineer";

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
    url.searchParams.set("app_id", creds.appId);
    url.searchParams.set("app_key", creds.appKey);
    url.searchParams.set("what", query);
    url.searchParams.set("results_per_page", String(Math.min(25, MAX_RESULTS_PER_PROVIDER)));
    url.searchParams.set("content-type", "application/json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) return [];

      const data = await response.json() as { results?: unknown[] };
      const jobs = Array.isArray(data?.results) ? data.results : [];

      for (const raw of jobs) {
        if (typeof raw !== "object" || raw === null) continue;
        const parsed = parseAdzunaJob(raw as Record<string, unknown>, country);
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
      provider: "ADZUNA",
      providerLabel: "Adzuna",
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    };
  }
}
