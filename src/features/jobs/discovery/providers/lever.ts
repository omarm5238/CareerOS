import { MAX_BOARDS_PER_PROVIDER, MAX_RESULTS_PER_PROVIDER } from "../constants";
import type { ProviderAttribution, ProviderJobResult, ProviderSearchRequest } from "../types";
import { LEVER_BOARDS, selectBoards } from "./boards";
import { fetchJson, ProviderRequestError } from "./http";
import { acceptProviderJob, capProviderJobs, inferCountryCode, isoTimestamp } from "./normalize-provider-job";
import type { ProviderSearchReport } from "./search-report";
import type { JobDiscoveryProvider } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function parseLeverJob(raw: Record<string, unknown>, company: string, allowedCountries: string[]): ProviderJobResult | null {
  const title = typeof raw.text === "string" ? raw.text.trim() : "";
  const categories = asRecord(raw.categories);
  const location = typeof categories?.location === "string" ? categories.location.trim() : null;
  const plain = typeof raw.descriptionPlain === "string" ? raw.descriptionPlain : "";
  const html = typeof raw.description === "string" ? raw.description : "";
  const hosted = typeof raw.hostedUrl === "string" ? raw.hostedUrl : "";
  const apply = typeof raw.applyUrl === "string" ? raw.applyUrl : hosted;
  const workplace = typeof raw.workplaceType === "string" ? raw.workplaceType.toLowerCase() : "";
  const commitment = typeof categories?.commitment === "string" ? categories.commitment.toLowerCase() : "";
  let employmentType: ProviderJobResult["employmentType"] = "UNKNOWN";
  if (commitment.includes("intern")) employmentType = "INTERNSHIP";
  else if (commitment.includes("contract")) employmentType = "CONTRACT";
  else if (commitment.includes("part")) employmentType = "PART_TIME";
  else if (commitment.includes("full")) employmentType = "FULL_TIME";
  const remote = workplace.includes("remote");
  const workMode: ProviderJobResult["workMode"] = remote ? "REMOTE" : workplace.includes("hybrid") ? "HYBRID" : location ? "ONSITE" : "UNKNOWN";

  return acceptProviderJob({
    provider: "LEVER",
    externalId: raw.id != null ? String(raw.id) : null,
    title,
    company,
    location,
    countryCode: inferCountryCode(location),
    workMode,
    employmentType,
    description: plain || html,
    salaryText: null,
    postedAt: isoTimestamp(raw.createdAt),
    expiresAt: null,
    sourceUrl: hosted || apply,
    applyUrl: apply || hosted,
    remote: workplace ? remote : null,
    visaSponsorship: null,
    sourceMetadata: {
      sourceType: "OFFICIAL_ATS",
      workplaceType: raw.workplaceType ?? null,
      country: raw.country ?? null,
    },
  }, allowedCountries);
}

export class LeverProvider implements JobDiscoveryProvider {
  provider = "LEVER" as const;
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
    const boards = selectBoards(LEVER_BOARDS, countries, MAX_BOARDS_PER_PROVIDER);
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
          `https://api.lever.co/v0/postings/${board.slug}?mode=json`,
          { method: "GET" },
          this.fetchImpl,
          20_000,
        );
        const jobs = Array.isArray(payload) ? payload : [];
        for (const raw of jobs) {
          const record = asRecord(raw);
          if (!record) {
            invalid++;
            continue;
          }
          const parsed = parseLeverJob(record, board.company, countries);
          if (!parsed) invalid++;
          else results.push(parsed);
        }
      } catch (error) {
        failures.push(error instanceof ProviderRequestError ? error : new ProviderRequestError("Lever request failed", "UNKNOWN"));
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
    return { provider: "LEVER", providerLabel: "Lever", sourceUrl: job.sourceUrl, applyUrl: job.applyUrl };
  }
}
