import { normalizeCountryCode } from "../quality/search-quality";
import type { ProviderJobResult } from "../types";

export function titlePriority(title: string): number {
  if (/\b(software engineer|software developer|softwareentwickler|backend|back[\s-]?end|full[\s-]?stack|front[\s-]?end|frontend|web developer)\b/i.test(title)) return 2;
  if (/\b(developer|engineer|entwickler|ontwikkelaar)\b/i.test(title)) return 1;
  return 0;
}

export function capProviderJobs(jobs: ProviderJobResult[], limit: number): ProviderJobResult[] {
  const groups = new Map<string, ProviderJobResult[]>();
  for (const job of jobs) {
    const group = groups.get(job.company) ?? [];
    group.push(job);
    groups.set(job.company, group);
  }
  const buckets = [...groups.values()];
  for (const group of buckets) group.sort((a, b) => titlePriority(b.title) - titlePriority(a.title));
  const share = Math.max(1, Math.ceil(limit / Math.max(buckets.length, 1)));
  const selected: ProviderJobResult[] = [];
  for (const group of buckets) selected.push(...group.slice(0, share));
  if (selected.length > limit) return selected.slice(0, limit);
  const chosen = new Set(selected);
  const remainder = buckets.flat().filter((job) => !chosen.has(job));
  remainder.sort((a, b) => titlePriority(b.title) - titlePriority(a.title));
  return selected.concat(remainder).slice(0, limit);
}

export function inferCountryCode(location: string | null | undefined): string | null {
  if (!location) return null;
  const text = location.replace(/İ/g, "I").replace(/ı/g, "i").toLowerCase();
  if (/turkiye|turkey|istanbul|ankara|izmir/.test(text)) return "TR";
  if (/germany|deutschland|berlin|munich|münchen|munchen|hamburg|frankfurt|cologne|köln|koln/.test(text)) return "DE";
  if (/netherlands|nederland|amsterdam|rotterdam|utrecht|eindhoven/.test(text)) return "NL";
  return normalizeCountryCode(location);
}

export function isoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value > 1_000_000_000 ? value * 1000 : null;
    if (millis == null) return null;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export function acceptProviderJob(job: ProviderJobResult | null, allowedCountries: string[]): ProviderJobResult | null {
  if (!job) return null;
  const title = job.title.trim();
  const company = job.company.trim();
  const description = job.description.trim();
  const url = job.applyUrl || job.sourceUrl;
  if (title.length < 2 || company.length < 2 || description.length < 40) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  if (job.expiresAt) {
    const expires = new Date(job.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires < Date.now()) return null;
  }
  const country = job.countryCode ?? inferCountryCode(job.location);
  if (allowedCountries.length > 0 && (country == null || !allowedCountries.includes(country))) return null;
  return { ...job, title, company, description, countryCode: country, sourceUrl: job.sourceUrl || url, applyUrl: job.applyUrl || url };
}
