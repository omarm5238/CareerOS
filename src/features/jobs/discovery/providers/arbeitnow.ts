import { PROVIDER_TIMEOUT_MS, MAX_RESULTS_PER_PROVIDER, MAX_PROVIDER_REQUESTS_PER_RUN } from "../constants";
import type { ProviderJobResult, ProviderSearchRequest, ProviderAttribution } from "../types";
import type { JobDiscoveryProvider } from "./types";

const BASE_URL = "https://www.arbeitnow.com/api/job-board-api";

function parseArbeitnowJob(raw: Record<string, unknown>): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const company = typeof raw.company_name === "string" ? raw.company_name.trim() : "";
  if (!title || !company) return null;

  const desc = typeof raw.description === "string" ? raw.description : "";
  const location = typeof raw.location === "string" ? raw.location.trim() : null;
  const remote = raw.remote === true;

  let workMode: ProviderJobResult["workMode"] = "UNKNOWN";
  if (remote) workMode = "REMOTE";
  else if (location) workMode = "ONSITE";

  const slug = typeof raw.slug === "string" ? raw.slug : "";
  const sourceUrl = typeof raw.url === "string" ? raw.url : (slug ? `https://www.arbeitnow.com/view/${slug}` : "https://www.arbeitnow.com");

  const createdAt = typeof raw.created_at === "number" ? new Date(raw.created_at * 1000).toISOString() : null;

  return {
    provider: "ARBEITNOW",
    externalId: slug || null,
    title,
    company,
    location,
    countryCode: null,
    workMode,
    employmentType: "FULL_TIME",
    description: desc,
    salaryText: null,
    postedAt: createdAt,
    expiresAt: null,
    sourceUrl,
    applyUrl: sourceUrl,
    remote,
    visaSponsorship: raw.visa_sponsorship === true ? true : null,
    sourceMetadata: {
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    },
  };
}

export class ArbeitnowProvider implements JobDiscoveryProvider {
  provider = "ARBEITNOW" as const;

  isConfigured(): boolean {
    return true;
  }

  getStatus(): "available" | "not_configured" | "unavailable" {
    return "available";
  }

  async search(request: ProviderSearchRequest): Promise<ProviderJobResult[]> {
    const results: ProviderJobResult[] = [];
    const maxPages = Math.min(MAX_PROVIDER_REQUESTS_PER_RUN, 3);

    for (let page = 1; page <= maxPages; page++) {
      if (results.length >= MAX_RESULTS_PER_PROVIDER) break;

      const url = `${BASE_URL}?page=${page}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        });

        if (!response.ok) {
          if (page === 1 && results.length === 0) {
            throw new Error(`Arbeitnow HTTP ${response.status}`);
          }
          break;
        }

        const data = await response.json() as { data?: unknown[] };
        const jobs = Array.isArray(data?.data) ? data.data : [];

        if (jobs.length === 0) break;

        for (const raw of jobs) {
          if (typeof raw !== "object" || raw === null) continue;
          const parsed = parseArbeitnowJob(raw as Record<string, unknown>);
          if (parsed) results.push(parsed);
          if (results.length >= MAX_RESULTS_PER_PROVIDER) break;
        }
      } catch (err) {
        if (page === 1 && results.length === 0) throw err;
        break;
      } finally {
        clearTimeout(timeout);
      }
    }

    // Local keyword filtering since the API may not have query params
    if (request.keywords.length > 0) {
      const lowerKeywords = request.keywords.map(k => k.toLowerCase());
      return results.filter(job => {
        const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
        return lowerKeywords.some(kw => text.includes(kw));
      });
    }

    return results;
  }

  getAttribution(job: ProviderJobResult): ProviderAttribution {
    return {
      provider: "ARBEITNOW",
      providerLabel: "Arbeitnow",
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    };
  }
}
