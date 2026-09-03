import { PROVIDER_TIMEOUT_MS, MAX_RESULTS_PER_PROVIDER } from "../constants";
import type { ProviderJobResult, ProviderSearchRequest, ProviderAttribution } from "../types";
import type { JobDiscoveryProvider } from "./types";

const BASE_URL = "https://remotive.com/api/remote-jobs";

function parseRemotiveJob(raw: Record<string, unknown>): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const company = typeof raw.company_name === "string" ? raw.company_name.trim() : "";
  if (!title || !company) return null;

  const desc = typeof raw.description === "string" ? raw.description : "";
  const location = typeof raw.candidate_required_location === "string" ? raw.candidate_required_location.trim() : null;

  let employmentType: ProviderJobResult["employmentType"] = "UNKNOWN";
  const jt = typeof raw.job_type === "string" ? raw.job_type.toLowerCase() : "";
  if (jt.includes("full")) employmentType = "FULL_TIME";
  else if (jt.includes("part")) employmentType = "PART_TIME";
  else if (jt.includes("contract") || jt.includes("freelance")) employmentType = "CONTRACT";
  else if (jt.includes("intern")) employmentType = "INTERNSHIP";

  const sourceUrl = typeof raw.url === "string" ? raw.url : `https://remotive.com/remote-jobs/${raw.id ?? ""}`;

  return {
    provider: "REMOTIVE",
    externalId: raw.id != null ? String(raw.id) : null,
    title,
    company,
    location: location || "Remote",
    countryCode: null,
    workMode: "REMOTE",
    employmentType,
    description: desc,
    salaryText: typeof raw.salary === "string" && raw.salary.trim() ? raw.salary.trim() : null,
    postedAt: typeof raw.publication_date === "string" ? raw.publication_date : null,
    expiresAt: null,
    sourceUrl,
    applyUrl: typeof raw.url === "string" ? raw.url : null,
    remote: true,
    visaSponsorship: null,
    sourceMetadata: {
      category: raw.category ?? null,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    },
  };
}

export class RemotiveProvider implements JobDiscoveryProvider {
  provider = "REMOTIVE" as const;

  isConfigured(): boolean {
    return true;
  }

  getStatus(): "available" | "not_configured" | "unavailable" {
    return "available";
  }

  async search(request: ProviderSearchRequest): Promise<ProviderJobResult[]> {
    const results: ProviderJobResult[] = [];
    const keywords = request.keywords.slice(0, 3);
    const searchTerms = keywords.length > 0 ? keywords : ["software"];

    for (const keyword of searchTerms) {
      if (results.length >= MAX_RESULTS_PER_PROVIDER) break;

      const url = new URL(BASE_URL);
      url.searchParams.set("search", keyword);
      url.searchParams.set("limit", String(Math.min(25, MAX_RESULTS_PER_PROVIDER - results.length)));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

      try {
        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        });

        if (!response.ok) continue;

        const data = await response.json() as { jobs?: unknown[] };
        const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

        for (const raw of jobs) {
          if (typeof raw !== "object" || raw === null) continue;
          const parsed = parseRemotiveJob(raw as Record<string, unknown>);
          if (parsed) results.push(parsed);
          if (results.length >= MAX_RESULTS_PER_PROVIDER) break;
        }
      } catch {
        // Provider failure isolated
      } finally {
        clearTimeout(timeout);
      }
    }

    return results;
  }

  getAttribution(job: ProviderJobResult): ProviderAttribution {
    return {
      provider: "REMOTIVE",
      providerLabel: "Remotive",
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    };
  }
}
