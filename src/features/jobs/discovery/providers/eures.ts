import { MAX_COUNTRIES_PER_PROVIDER, MAX_PAGES_PER_QUERY, MAX_RESULTS_PER_PROVIDER } from "../constants";
import { stripHtml } from "../normalization/normalize-text";
import type { ProviderAttribution, ProviderJobResult, ProviderSearchRequest } from "../types";
import { fetchJson, ProviderRequestError } from "./http";
import { acceptProviderJob, isoTimestamp } from "./normalize-provider-job";
import { countriesForProvider } from "./query-planner";
import type { ProviderSearchReport } from "./search-report";
import type { JobDiscoveryProvider } from "./types";
import type { SearchIntent } from "../quality/search-quality";

const EURES_SEARCH_URL = "https://europa.eu/eures/api/jv-searchengine/public/jv-search/search";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function employerName(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["name", "legalName", "organizationName"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  const nested = Object.values(record).map(asRecord).find((item) => item && typeof item.name === "string");
  return typeof nested?.name === "string" ? nested.name.trim() : "";
}

const EURES_COUNTRY_LABELS: Record<string, string> = {
  DE: "Germany",
  NL: "Netherlands",
  AT: "Austria",
  FR: "France",
  BE: "Belgium",
  ES: "Spain",
  PL: "Poland",
  IT: "Italy",
};

function locationText(value: unknown, countryCode: string): string | null {
  const label = EURES_COUNTRY_LABELS[countryCode] ?? countryCode;
  const record = asRecord(value);
  if (!record) return label;
  const named = [record.city, record.region, record.country, record.location]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  if (named.length > 0) return named.join(", ");
  const codes = Object.keys(record)
    .filter((key) => /^[A-Za-z]{2}$/.test(key))
    .map((key) => EURES_COUNTRY_LABELS[key.toUpperCase()] ?? key.toUpperCase());
  return codes.length > 0 ? codes.join(", ") : label;
}

function parseEuresJob(raw: Record<string, unknown>, countryCode: string): ProviderJobResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const id = raw.id != null ? String(raw.id) : "";
  const description = typeof raw.description === "string" ? stripHtml(raw.description) : "";
  const company = employerName(raw.employer);
  const sourceUrl = id ? `https://europa.eu/eures/portal/jv-se/jv-details/${encodeURIComponent(id)}` : "";
  return acceptProviderJob({
    provider: "EURES",
    externalId: id || null,
    title,
    company,
    location: locationText(raw.locationMap, countryCode),
    countryCode,
    workMode: "UNKNOWN",
    employmentType: "UNKNOWN",
    description,
    salaryText: null,
    postedAt: isoTimestamp(raw.creationDate ?? raw.lastModificationDate),
    expiresAt: null,
    sourceUrl,
    applyUrl: sourceUrl,
    remote: null,
    visaSponsorship: null,
    sourceMetadata: { sourceType: "PUBLIC_REGIONAL", countryCode },
  }, [countryCode]);
}

export class EuresProvider implements JobDiscoveryProvider {
  provider = "EURES" as const;
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
      .map((country) => country.toUpperCase())
      .slice(0, MAX_COUNTRIES_PER_PROVIDER);
    const keyword = request.keywords.find((item) => item.trim().length > 3 && !/^engineer$/i.test(item.trim())) ?? "";
    if (countries.length === 0 || !keyword) {
      this.report = { status: "unsupported_target", requestsMade: 0, boardsQueried: 0, fetched: 0, invalidRemoved: 0 };
      return [];
    }

    const results: ProviderJobResult[] = [];
    const failures: ProviderRequestError[] = [];
    let invalid = 0;
    for (const country of countries) {
      if (results.length >= MAX_RESULTS_PER_PROVIDER) break;
      for (let page = 1; page <= MAX_PAGES_PER_QUERY; page++) {
        try {
          const payload = await fetchJson(EURES_SEARCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resultsPerPage: Math.min(15, MAX_RESULTS_PER_PROVIDER),
              page,
              sortSearch: "MOST_RECENT",
              keywords: [{ keyword, specificSearchCode: "TITLE" }],
              publicationPeriod: null,
              occupationUris: [],
              skillUris: [],
              requiredExperienceCodes: [],
              positionScheduleCodes: [],
              sectorCodes: [],
              educationAndQualificationLevelCodes: [],
              positionOfferingCodes: [],
              locationCodes: [country.toLowerCase()],
              euresFlagCodes: [],
              otherBenefitsCodes: [],
              requiredLanguages: [],
              minNumberPost: null,
              sessionId: "careeros-discovery",
              requestLanguage: "en",
            }),
          }, this.fetchImpl);
          const record = asRecord(payload);
          const jobs = Array.isArray(record?.jvs) ? record.jvs : [];
          for (const raw of jobs) {
            const item = asRecord(raw);
            if (!item) {
              invalid++;
              continue;
            }
            const parsed = parseEuresJob(item, country);
            if (!parsed) invalid++;
            else results.push(parsed);
            if (results.length >= MAX_RESULTS_PER_PROVIDER) break;
          }
        } catch (error) {
          failures.push(error instanceof ProviderRequestError ? error : new ProviderRequestError("EURES request failed", "UNKNOWN"));
        }
      }
    }

    this.report = {
      status: results.length > 0 && failures.length > 0 ? "partial" : results.length > 0 ? "success" : failures.some((failure) => failure.category === "RATE_LIMITED") ? "rate_limited" : "failed",
      requestsMade: countries.length * MAX_PAGES_PER_QUERY,
      boardsQueried: 0,
      fetched: results.length,
      invalidRemoved: invalid,
    };
    if (results.length === 0 && failures.length > 0) throw failures[0];
    return results;
  }

  getAttribution(job: ProviderJobResult): ProviderAttribution {
    return { provider: "EURES", providerLabel: "EURES", sourceUrl: job.sourceUrl, applyUrl: job.applyUrl };
  }
}

export function euresCountries(intent: SearchIntent): string[] {
  return countriesForProvider("EURES", intent);
}
