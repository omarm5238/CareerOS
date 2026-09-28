import { MAX_BOARDS_PER_PROVIDER, MAX_RESULTS_PER_PROVIDER } from "../constants";
import { stripHtml } from "../normalization/normalize-text";
import type { ProviderAttribution, ProviderJobResult, ProviderSearchRequest } from "../types";
import { GREENHOUSE_BOARDS, selectBoards } from "./boards";
import { fetchJson, ProviderRequestError } from "./http";
import { acceptProviderJob, capProviderJobs, inferCountryCode, isoTimestamp } from "./normalize-provider-job";
import type { ProviderSearchReport } from "./search-report";
import type { JobDiscoveryProvider } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function parseGreenhouseJob(raw: Record<string, unknown>, company: string, allowedCountries: string[]): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const locationRecord = asRecord(raw.location);
  const location = typeof locationRecord?.name === "string" ? locationRecord.name.trim() : null;
  const content = typeof raw.content === "string" ? stripHtml(raw.content) : "";
  const url = typeof raw.absolute_url === "string" ? raw.absolute_url : "";
  return acceptProviderJob({
    provider: "GREENHOUSE",
    externalId: raw.id != null ? String(raw.id) : null,
    title,
    company,
    location,
    countryCode: inferCountryCode(location),
    workMode: /\bremote\b/i.test(`${location ?? ""} ${title}`) ? "REMOTE" : location ? "ONSITE" : "UNKNOWN",
    employmentType: "UNKNOWN",
    description: content,
    salaryText: null,
    postedAt: isoTimestamp(raw.updated_at),
    expiresAt: null,
    sourceUrl: url,
    applyUrl: url,
    remote: /\bremote\b/i.test(location ?? "") ? true : null,
    visaSponsorship: null,
    sourceMetadata: { sourceType: "OFFICIAL_ATS", board: company },
  }, allowedCountries);
}

export class GreenhouseProvider implements JobDiscoveryProvider {
  provider = "GREENHOUSE" as const;
  private report: ProviderSearchReport | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  isConfigured(): boolean {
    return true;
  }

  getStatus(): "available" | "not_configured" | "unavailable" {
    return "available";
  }

  takeSearchReport(): ProviderSearchReport | null {
    return this.report;
  }

  async search(request: ProviderSearchRequest): Promise<ProviderJobResult[]> {
    const countries = (request.countryCodes?.length ? request.countryCodes : request.countryCode ? [request.countryCode] : [])
      .map((country) => country.toUpperCase());
    const boards = selectBoards(GREENHOUSE_BOARDS, countries, MAX_BOARDS_PER_PROVIDER);
    const results: ProviderJobResult[] = [];
    const failures: ProviderRequestError[] = [];
    let invalid = 0;
    if (boards.length === 0) {
      this.report = { status: "unsupported_target", requestsMade: 0, boardsQueried: 0, fetched: 0, invalidRemoved: 0 };
      return [];
    }

    for (const board of boards) {
      try {
        const payload = await fetchJson(
          `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true`,
          { method: "GET" },
          this.fetchImpl,
          25_000,
        );
        const jobs = asRecord(payload);
        const list = Array.isArray(jobs?.jobs) ? jobs.jobs : [];
        for (const raw of list) {
          const record = asRecord(raw);
          if (!record) {
            invalid++;
            continue;
          }
          const parsed = parseGreenhouseJob(record, board.company, countries);
          if (!parsed) invalid++;
          else results.push(parsed);
        }
      } catch (error) {
        failures.push(error instanceof ProviderRequestError ? error : new ProviderRequestError("Greenhouse request failed", "UNKNOWN"));
      }
    }

    this.report = {
      status: results.length > 0 && failures.length > 0 ? "partial" : results.length > 0 ? "success" : failures.some((failure) => failure.category === "RATE_LIMITED") ? "rate_limited" : "failed",
      requestsMade: boards.length,
      boardsQueried: boards.length,
      fetched: results.length,
      invalidRemoved: invalid,
    };
    if (results.length === 0 && failures.length > 0) throw failures[0];
    const capped = capProviderJobs(results, MAX_RESULTS_PER_PROVIDER);
    this.report = { ...this.report!, fetched: capped.length };
    return capped;
  }

  getAttribution(job: ProviderJobResult): ProviderAttribution {
    return { provider: "GREENHOUSE", providerLabel: "Greenhouse", sourceUrl: job.sourceUrl, applyUrl: job.applyUrl };
  }
}
