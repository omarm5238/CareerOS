import { canonicalizeUrl } from "../normalization/canonicalize-url";
import { normalizeCompany, normalizeLocation, normalizeTitle } from "../normalization/normalize-text";
import {
  normalizeTechIds,
  previewJobSignals,
  type RoleFamily,
  type SeniorityLevel,
} from "@/features/jobs/matching/canonical-match";

import type { JobDiscoveryProfileData } from "../types";

export const LOCATION_MODES = [
  "CURRENT_COUNTRY",
  "SELECTED_COUNTRIES",
  "REMOTE_ONLY",
  "CURRENT_COUNTRY_PLUS_REMOTE",
  "SELECTED_COUNTRIES_PLUS_REMOTE",
] as const;

export type LocationSearchMode = (typeof LOCATION_MODES)[number];
export type TrustTier = "TIER_A" | "TIER_B" | "TIER_C";
export type RegionCode = "WORLDWIDE" | "EUROPE" | "EMEA" | "NORTH_AMERICA" | "LATAM" | "APAC";

export type RemotePolicy = {
  worldwide: boolean;
  regions: RegionCode[];
  acceptingCurrentCountry: boolean;
  acceptingSelectedCountries: boolean;
};

export type SearchIntent = {
  preferredTitles: string[];
  excludedTitles: string[];
  allowedSeniority: SeniorityLevel[];
  excludedSeniority: SeniorityLevel[];
  preferredStack: string[];
  avoidWhenMandatoryStack: string[];
  locationMode: LocationSearchMode;
  currentCountryCode: string | null;
  currentCity: string | null;
  selectedCountryCodes: string[];
  remote: RemotePolicy;
  employmentTypes: string[];
  freshnessDays: number;
  minimumTrust: TrustTier;
  aggregatorsAllowed: boolean;
};

export type DiscoveryQualityJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  countryCode: string | null;
  workMode: string;
  employmentType: string;
  description: string;
  postedAt: string | null;
  expiresAt: string | null;
  sourceUrl: string;
  applyUrl: string | null;
  provider: string;
  externalId: string | null;
};

export type FilterStats = {
  fetched: number;
  normalized: number;
  duplicatesRemoved: number;
  roleFiltered: number;
  seniorityFiltered: number;
  stackFiltered: number;
  employmentFiltered: number;
  geoFiltered: number;
  freshnessFiltered: number;
  trustFiltered: number;
  kept: number;
  locationIncomplete: boolean;
};

const COUNTRY_ALIASES: Record<string, string> = {
  tr: "TR",
  turkiye: "TR",
  turkey: "TR",
  türkiye: "TR",
  de: "DE",
  germany: "DE",
  deutschland: "DE",
  nl: "NL",
  netherlands: "NL",
  "the netherlands": "NL",
  holland: "NL",
  ae: "AE",
  uae: "AE",
  "united arab emirates": "AE",
  sa: "SA",
  ksa: "SA",
  "saudi arabia": "SA",
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s": "US",
  "united states": "US",
  "united states of america": "US",
  gb: "GB",
  uk: "GB",
  "u.k.": "GB",
  "united kingdom": "GB",
  fr: "FR",
  france: "FR",
};

const COUNTRY_NAMES: Record<string, string> = {
  TR: "Türkiye",
  DE: "Germany",
  NL: "Netherlands",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
};

/**
 * Region membership used by remote policy.
 * Türkiye is EMEA. It is not treated as Europe, because many "Europe remote"
 * postings mean the EU and do not accept Türkiye.
 * Germany, Netherlands, France, and the UK are Europe and EMEA.
 */
const REGION_MEMBERS: Record<Exclude<RegionCode, "WORLDWIDE">, string[]> = {
  EUROPE: ["DE", "NL", "FR", "GB", "AT", "ES", "IT", "PL"],
  EMEA: ["TR", "DE", "NL", "FR", "GB", "AE", "SA", "AT", "ES", "IT", "PL", "ZA"],
  NORTH_AMERICA: ["US", "CA"],
  LATAM: ["BR", "MX"],
  APAC: ["SG", "IN", "AU"],
};

const SENIORITY_LEVELS: SeniorityLevel[] = [
  "INTERN", "ENTRY", "JUNIOR", "MID", "SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT",
];

const DEFAULT_EXCLUDED_SENIORITY: SeniorityLevel[] = ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"];
const DEFAULT_ALLOWED_SENIORITY: SeniorityLevel[] = ["INTERN", "ENTRY", "JUNIOR", "MID"];

const ROLE_FAMILY_HINTS: Array<{ pattern: RegExp; family: RoleFamily }> = [
  { pattern: /full[\s-]?stack/i, family: "FULLSTACK_ENGINEERING" },
  { pattern: /back[\s-]?end/i, family: "BACKEND_ENGINEERING" },
  { pattern: /front[\s-]?end|web developer/i, family: "FRONTEND_ENGINEERING" },
  { pattern: /software engineer|software developer/i, family: "SOFTWARE_ENGINEERING" },
  { pattern: /mobile|ios|android|flutter/i, family: "MOBILE_ENGINEERING" },
  { pattern: /devops|sre|infrastructure/i, family: "DEVOPS_INFRA" },
  { pattern: /data engineer|data scientist/i, family: "DATA_ENGINEERING" },
  { pattern: /machine learning|ml engineer/i, family: "AI_ML_ENGINEERING" },
];

const CAREFUL_NON_TARGET = /\b(sales engineer|solutions engineer|support engineer|customer support|qa engineer|quality assurance|recruiter|talent acquisition|journalist|reporter|graphic designer|account executive)\b/i;

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/\./g, "");
  if (!key) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (COUNTRY_ALIASES[value.trim().toLowerCase()]) return COUNTRY_ALIASES[value.trim().toLowerCase()];
  if (/^[a-z]{2}$/i.test(value.trim())) return value.trim().toUpperCase();
  return null;
}

export function countryName(code: string | null): string {
  if (!code) return "";
  return COUNTRY_NAMES[code] ?? code;
}

export function countryInRegion(countryCode: string | null, region: RegionCode): boolean {
  if (!countryCode || region === "WORLDWIDE") return region === "WORLDWIDE";
  return REGION_MEMBERS[region]?.includes(countryCode) ?? false;
}

export function interpretSearchProfile(profile: JobDiscoveryProfileData): SearchIntent {
  const stored = profile.searchIntent;
  const locationCodes = profile.locationTargets
    .filter((target) => target.enabled)
    .map((target) => normalizeCountryCode(target.countryCode) ?? normalizeCountryCode(target.country))
    .filter((code): code is string => Boolean(code));
  const currentCountryCode = stored?.currentCountryCode
    ? normalizeCountryCode(stored.currentCountryCode)
    : locationCodes[0] ?? null;
  const selectedCountryCodes = (stored?.selectedCountryCodes ?? locationCodes)
    .map((code) => normalizeCountryCode(code))
    .filter((code): code is string => Boolean(code));
  const remoteWanted = profile.workModes.includes("REMOTE");
  const derivedMode: LocationSearchMode = currentCountryCode && remoteWanted
    ? "CURRENT_COUNTRY_PLUS_REMOTE"
    : currentCountryCode
      ? "CURRENT_COUNTRY"
      : selectedCountryCodes.length > 0
        ? "SELECTED_COUNTRIES"
        : "CURRENT_COUNTRY";
  const locationMode = isLocationMode(stored?.locationMode) ? stored.locationMode : derivedMode;
  const preferredTitles = (stored?.preferredTitles?.length
    ? stored.preferredTitles
    : profile.roleTargets.filter((target) => target.enabled).map((target) => target.title)
  ).filter(Boolean);
  const excludedSeniority = (stored?.excludedSeniority?.length
    ? stored.excludedSeniority
    : DEFAULT_EXCLUDED_SENIORITY) as SeniorityLevel[];
  const allowedSeniority = (stored?.allowedSeniority?.length
    ? stored.allowedSeniority
    : seniorityFromProfile(profile.experienceLevels)) as SeniorityLevel[];

  return {
    preferredTitles,
    excludedTitles: stored?.excludedTitles ?? [
      "Sales Engineer",
      "Solutions Engineer",
      "Support Engineer",
      "Recruiter",
      "Journalist",
      "Graphic Designer",
    ],
    allowedSeniority,
    excludedSeniority,
    preferredStack: stored?.preferredStack ?? profile.includedKeywords,
    avoidWhenMandatoryStack: stored?.avoidWhenMandatoryStack ?? [],
    locationMode,
    currentCountryCode,
    currentCity: stored?.currentCity ?? profile.locationTargets.find((target) => target.enabled)?.cities[0] ?? null,
    selectedCountryCodes,
    remote: {
      worldwide: stored?.remote?.worldwide ?? false,
      regions: (stored?.remote?.regions ?? []).filter(isRegionCode),
      acceptingCurrentCountry: stored?.remote?.acceptingCurrentCountry ?? remoteWanted,
      acceptingSelectedCountries: stored?.remote?.acceptingSelectedCountries ?? false,
    },
    employmentTypes: stored?.employmentTypes?.length ? stored.employmentTypes : profile.employmentTypes,
    freshnessDays: stored?.freshnessDays ?? profile.freshnessDays,
    minimumTrust: stored?.minimumTrust ?? "TIER_C",
    aggregatorsAllowed: stored?.aggregatorsAllowed ?? true,
  };
}

function isLocationMode(value: string | undefined): value is LocationSearchMode {
  return LOCATION_MODES.includes(value as LocationSearchMode);
}

function isRegionCode(value: string): value is RegionCode {
  return value === "WORLDWIDE" || value === "EUROPE" || value === "EMEA" || value === "NORTH_AMERICA" || value === "LATAM" || value === "APAC";
}

function seniorityFromProfile(levels: string[]): SeniorityLevel[] {
  if (levels.length === 0) return DEFAULT_ALLOWED_SENIORITY;
  const allowed = new Set<SeniorityLevel>();
  for (const level of levels) {
    const text = level.toLowerCase();
    if (/intern/.test(text)) allowed.add("INTERN");
    if (/entry|graduate|junior/.test(text)) {
      allowed.add("ENTRY");
      allowed.add("JUNIOR");
    }
    if (/mid/.test(text)) allowed.add("MID");
    if (/senior|staff|principal|lead|manager/.test(text)) allowed.add(text.includes("staff") ? "STAFF" : "SENIOR");
  }
  return allowed.size > 0 ? [...allowed] : DEFAULT_ALLOWED_SENIORITY;
}

export function preferredRoleFamilies(intent: SearchIntent): Set<RoleFamily> {
  const families = new Set<RoleFamily>();
  for (const title of intent.preferredTitles) {
    for (const hint of ROLE_FAMILY_HINTS) {
      if (hint.pattern.test(title)) families.add(hint.family);
    }
  }
  if (families.size === 0) {
    families.add("SOFTWARE_ENGINEERING");
    families.add("BACKEND_ENGINEERING");
    families.add("FULLSTACK_ENGINEERING");
  }
  if (families.has("BACKEND_ENGINEERING") || families.has("FULLSTACK_ENGINEERING")) {
    families.add("SOFTWARE_ENGINEERING");
  }
  return families;
}

export function providerTrust(job: Pick<DiscoveryQualityJob, "provider" | "sourceUrl" | "applyUrl">): TrustTier {
  const url = `${job.applyUrl ?? ""} ${job.sourceUrl}`.toLowerCase();
  if (/greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com/.test(url)) return "TIER_A";
  if (job.provider === "GREENHOUSE" || job.provider === "LEVER" || job.provider === "ASHBY") return "TIER_A";
  if (job.provider === "EURES" || ["REMOTIVE", "ARBEITNOW", "ADZUNA", "JOOBLE"].includes(job.provider)) return "TIER_B";
  if (/remotive\.com|arbeitnow\.com|adzuna\.|jooble\.org/.test(url)) return "TIER_B";
  return "TIER_C";
}

function trustRank(tier: TrustTier): number {
  if (tier === "TIER_A") return 3;
  if (tier === "TIER_B") return 2;
  return 1;
}

export function classifyRemote(job: DiscoveryQualityJob): {
  remote: boolean;
  scope: "WORLDWIDE" | "REGION" | "COUNTRY" | "UNSPECIFIED" | "NONE";
  region: RegionCode | null;
  countryCode: string | null;
} {
  const text = `${job.location ?? ""}\n${job.title}\n${job.description.slice(0, 900)}`;
  const remote = job.workMode === "REMOTE" || /\bremote\b/i.test(text);
  if (!remote) return { remote: false, scope: "NONE", region: null, countryCode: normalizeCountryCode(job.countryCode) };
  if (/\b(worldwide|work from anywhere|anywhere in the world|global remote)\b/i.test(text)) {
    return { remote: true, scope: "WORLDWIDE", region: "WORLDWIDE", countryCode: null };
  }
  const restricted = restrictedCountry(text);
  if (restricted) return { remote: true, scope: "COUNTRY", region: null, countryCode: restricted };
  if (/\b(europe|eu|european union)\b/i.test(text)) return { remote: true, scope: "REGION", region: "EUROPE", countryCode: null };
  if (/\bemea\b/i.test(text)) return { remote: true, scope: "REGION", region: "EMEA", countryCode: null };
  if (/\b(north america|usa and canada)\b/i.test(text)) return { remote: true, scope: "REGION", region: "NORTH_AMERICA", countryCode: null };
  if (/\b(latam|latin america)\b/i.test(text)) return { remote: true, scope: "REGION", region: "LATAM", countryCode: null };
  if (/\bapac\b/i.test(text)) return { remote: true, scope: "REGION", region: "APAC", countryCode: null };
  return { remote: true, scope: "UNSPECIFIED", region: null, countryCode: normalizeCountryCode(job.countryCode) };
}

function restrictedCountry(text: string): string | null {
  if (/\b(us-only|usa only|u\.s\. only|united states only|remote\s*\(?\s*us\b|must be (?:located |based )?(?:in|within) the (?:us|u\.s\.|united states))\b/i.test(text)) return "US";
  if (/\b(canada-only|canada only|must be (?:based|located) in canada)\b/i.test(text)) return "CA";
  if (/\b(uk-only|uk only|united kingdom only|must be based in the uk)\b/i.test(text)) return "GB";
  if (/\b(germany only|deutschland only|must be based in germany)\b/i.test(text)) return "DE";
  if (/\b(netherlands only|must be based in the netherlands)\b/i.test(text)) return "NL";
  if (/\b(türkiye only|turkey only|must be based in (?:türkiye|turkey|turkiye))\b/i.test(text)) return "TR";
  return null;
}

export function remotePolicyAllows(job: DiscoveryQualityJob, intent: SearchIntent): boolean {
  const remote = classifyRemote(job);
  if (!remote.remote) return false;
  if (remote.scope === "UNSPECIFIED") return false;
  if (remote.scope === "WORLDWIDE") return intent.remote.worldwide;
  if (remote.scope === "REGION" && remote.region) {
    if (!intent.remote.regions.includes(remote.region)) return false;
    const anchors = anchorCountries(intent);
    return anchors.some((country) => countryInRegion(country, remote.region!));
  }
  if (remote.scope === "COUNTRY" && remote.countryCode) {
    if (intent.remote.acceptingCurrentCountry && remote.countryCode === intent.currentCountryCode) return true;
    if (intent.remote.acceptingSelectedCountries && intent.selectedCountryCodes.includes(remote.countryCode)) return true;
    return false;
  }
  return false;
}

function anchorCountries(intent: SearchIntent): string[] {
  return [...new Set([intent.currentCountryCode, ...intent.selectedCountryCodes].filter((code): code is string => Boolean(code)))];
}

function localCountry(job: DiscoveryQualityJob): string | null {
  return normalizeCountryCode(job.countryCode) ?? countryFromText(job.location) ?? countryFromText(job.description.slice(0, 240));
}

function countryFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.length < 3) continue;
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(value)) return code;
  }
  return null;
}

export function geoAllows(job: DiscoveryQualityJob, intent: SearchIntent): { allow: boolean; reason: string | null } {
  const mode = intent.locationMode;
  const needsCurrent = mode === "CURRENT_COUNTRY" || mode === "CURRENT_COUNTRY_PLUS_REMOTE";
  if (needsCurrent && !intent.currentCountryCode) {
    return { allow: false, reason: "missing_current_country" };
  }
  const remote = classifyRemote(job);
  const country = localCountry(job);
  const localMatch = (codes: string[]) => country != null && codes.includes(country) && remote.scope !== "COUNTRY";

  if (mode === "CURRENT_COUNTRY") {
    if (!remote.remote && country === intent.currentCountryCode) return { allow: true, reason: null };
    if (remote.remote && remotePolicyAllows(job, intent) && (remote.scope !== "COUNTRY" || remote.countryCode === intent.currentCountryCode)) {
      return { allow: true, reason: null };
    }
    return { allow: false, reason: "geo" };
  }
  if (mode === "SELECTED_COUNTRIES") {
    if (localMatch(intent.selectedCountryCodes) && !remote.remote) return { allow: true, reason: null };
    if (remote.remote && remote.scope === "COUNTRY" && remote.countryCode && intent.selectedCountryCodes.includes(remote.countryCode) && remotePolicyAllows(job, intent)) {
      return { allow: true, reason: null };
    }
    return { allow: false, reason: "geo" };
  }
  if (mode === "REMOTE_ONLY") {
    if (remote.remote && remotePolicyAllows(job, intent)) return { allow: true, reason: null };
    return { allow: false, reason: "geo" };
  }
  if (mode === "CURRENT_COUNTRY_PLUS_REMOTE") {
    if (!remote.remote && country === intent.currentCountryCode) return { allow: true, reason: null };
    if (remote.remote && remotePolicyAllows(job, intent)) return { allow: true, reason: null };
    return { allow: false, reason: "geo" };
  }
  if (!remote.remote && localMatch(intent.selectedCountryCodes)) return { allow: true, reason: null };
  if (remote.remote && remotePolicyAllows(job, intent)) return { allow: true, reason: null };
  return { allow: false, reason: "geo" };
}

function titleExcluded(title: string, intent: SearchIntent): boolean {
  if (CAREFUL_NON_TARGET.test(title)) {
    const explicitlyWanted = intent.preferredTitles.some((preferred) =>
      CAREFUL_NON_TARGET.test(preferred) && new RegExp(preferred.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(title),
    );
    if (!explicitlyWanted) return true;
  }
  return intent.excludedTitles.some((excluded) => {
    const token = excluded.trim();
    if (!token) return false;
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title);
  });
}

function roleAllowed(job: DiscoveryQualityJob, intent: SearchIntent): boolean {
  if (titleExcluded(job.title, intent)) return false;
  const family = previewJobSignals(job).roleFamily;
  const preferred = preferredRoleFamilies(intent);
  if (family === "UNKNOWN" || family === "JOURNALISM" || family === "SALES" || family === "MARKETING" || family === "HR" || family === "RECRUITING" || family === "ACCOUNTING" || family === "GRAPHIC_DESIGN" || family === "CUSTOMER_SERVICE" || family === "OTHER_NON_TECH") {
    return false;
  }
  return preferred.has(family);
}

function seniorityAllowed(job: DiscoveryQualityJob, intent: SearchIntent): boolean {
  const seniority = previewJobSignals(job).seniority;
  if (seniority === "UNKNOWN") return true;
  if (intent.excludedSeniority.includes(seniority)) return false;
  if (intent.allowedSeniority.length > 0 && !intent.allowedSeniority.includes(seniority)) return false;
  return true;
}

function stackAllowed(job: DiscoveryQualityJob, intent: SearchIntent): boolean {
  if (intent.avoidWhenMandatoryStack.length === 0) return true;
  const blocked = new Set(normalizeTechIds(intent.avoidWhenMandatoryStack));
  const core = previewJobSignals(job).coreTechIds;
  return !core.some((id) => blocked.has(id));
}

function employmentAllowed(job: DiscoveryQualityJob, intent: SearchIntent): boolean {
  if (intent.employmentTypes.length === 0) return true;
  if (!job.employmentType || job.employmentType === "UNKNOWN" || job.employmentType === "OTHER") return true;
  return intent.employmentTypes.includes(job.employmentType);
}

export function freshnessDecision(job: DiscoveryQualityJob, intent: SearchIntent, now = Date.now()): "fresh" | "stale" | "unknown" | "expired" {
  if (job.expiresAt) {
    const expires = new Date(job.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires < now) return "expired";
  }
  if (!job.postedAt) return "unknown";
  const posted = new Date(job.postedAt).getTime();
  if (Number.isNaN(posted)) return "unknown";
  const ageDays = (now - posted) / 86_400_000;
  if (intent.freshnessDays > 0 && ageDays > intent.freshnessDays) return "stale";
  return "fresh";
}

function dedupeJobs(jobs: DiscoveryQualityJob[]): { kept: DiscoveryQualityJob[]; removed: number } {
  const groups: DiscoveryQualityJob[][] = [];
  const indexByKey = new Map<string, number>();

  for (const job of jobs) {
    const keys = dedupeKeys(job);
    const indexes = [...new Set(keys.map((key) => indexByKey.get(key)).filter((value): value is number => value != null))];
    let index = indexes[0];
    if (index == null) {
      index = groups.length;
      groups.push([]);
    }
    for (const other of indexes.slice(1)) {
      if (other === index) continue;
      groups[index].push(...groups[other]);
      groups[other] = [];
      for (const [key, value] of indexByKey) {
        if (value === other) indexByKey.set(key, index);
      }
    }
    groups[index].push(job);
    for (const key of keys) indexByKey.set(key, index);
  }

  const kept: DiscoveryQualityJob[] = [];
  let removed = 0;
  for (const group of groups) {
    if (group.length === 0) continue;
    const winner = [...group].sort((a, b) => {
      const trust = trustRank(providerTrust(b)) - trustRank(providerTrust(a));
      if (trust !== 0) return trust;
      return b.description.length - a.description.length;
    })[0];
    kept.push(winner);
    removed += group.length - 1;
  }
  return { kept, removed };
}

function dedupeKeys(job: DiscoveryQualityJob): string[] {
  const keys: string[] = [];
  const url = canonicalizeUrl(job.applyUrl || job.sourceUrl);
  if (url && url.length > 12) keys.push(`url:${url}`);
  if (job.externalId) keys.push(`ext:${job.provider}:${job.externalId}`);
  const country = localCountry(job) ?? "";
  const city = normalizeLocation(job.location) ?? "";
  keys.push(`post:${normalizeCompany(job.company)}|${normalizeTitle(job.title)}|${country}|${city}`);
  return keys;
}

export function prepareDiscoveryCandidates(
  jobs: DiscoveryQualityJob[],
  intent: SearchIntent,
  now = Date.now(),
): { kept: DiscoveryQualityJob[]; stats: FilterStats } {
  const stats: FilterStats = {
    fetched: jobs.length,
    normalized: 0,
    duplicatesRemoved: 0,
    roleFiltered: 0,
    seniorityFiltered: 0,
    stackFiltered: 0,
    employmentFiltered: 0,
    geoFiltered: 0,
    freshnessFiltered: 0,
    trustFiltered: 0,
    kept: 0,
    locationIncomplete: (intent.locationMode === "CURRENT_COUNTRY" || intent.locationMode === "CURRENT_COUNTRY_PLUS_REMOTE") && !intent.currentCountryCode,
  };
  const valid = jobs.filter((job) => job.title.trim() && job.company.trim() && job.description.trim().length >= 20);
  stats.normalized = valid.length;
  const deduped = dedupeJobs(valid);
  stats.duplicatesRemoved = deduped.removed;
  const kept: DiscoveryQualityJob[] = [];
  for (const job of deduped.kept) {
    if (!roleAllowed(job, intent)) {
      stats.roleFiltered++;
      continue;
    }
    if (!seniorityAllowed(job, intent)) {
      stats.seniorityFiltered++;
      continue;
    }
    if (!employmentAllowed(job, intent)) {
      stats.employmentFiltered++;
      continue;
    }
    if (!stackAllowed(job, intent)) {
      stats.stackFiltered++;
      continue;
    }
    const geo = geoAllows(job, intent);
    if (!geo.allow) {
      stats.geoFiltered++;
      continue;
    }
    const freshness = freshnessDecision(job, intent, now);
    if (freshness === "stale" || freshness === "expired") {
      stats.freshnessFiltered++;
      continue;
    }
    const trust = providerTrust(job);
    if (!intent.aggregatorsAllowed && trust === "TIER_B") {
      stats.trustFiltered++;
      continue;
    }
    if (trustRank(trust) < trustRank(intent.minimumTrust)) {
      stats.trustFiltered++;
      continue;
    }
    kept.push(job);
  }
  stats.kept = kept.length;
  return { kept, stats };
}

export function queryTitles(intent: SearchIntent): string[] {
  const titles = intent.preferredTitles
    .map((title) => title.trim())
    .filter((title) => title.length > 3 && !/^engineer$/i.test(title));
  return [...new Set(titles)].slice(0, 6);
}

export function queryCountries(intent: SearchIntent): string[] {
  if (intent.locationMode === "REMOTE_ONLY") return [];
  if (intent.locationMode === "CURRENT_COUNTRY" || intent.locationMode === "CURRENT_COUNTRY_PLUS_REMOTE") {
    return intent.currentCountryCode ? [intent.currentCountryCode] : [];
  }
  return intent.selectedCountryCodes.slice(0, 3);
}

export type RankedDiscoveryJob = DiscoveryQualityJob & {
  canonicalScore: number | null;
  eligibility: "ELIGIBLE" | "REVIEW_REQUIRED" | "INELIGIBLE";
};

const TRUST_BONUS = { TIER_A: 6, TIER_B: 3, TIER_C: 0 };

/**
 * Canonical score stays the match authority.
 * Trust and freshness only reorder jobs whose canonical scores are within 8 points.
 */
export function compareDiscoveryRank(a: RankedDiscoveryJob, b: RankedDiscoveryJob, now = Date.now()): number {
  const eligibilityRank = (value: RankedDiscoveryJob["eligibility"]) => value === "ELIGIBLE" ? 2 : value === "REVIEW_REQUIRED" ? 1 : 0;
  const eligibility = eligibilityRank(b.eligibility) - eligibilityRank(a.eligibility);
  if (eligibility !== 0) return eligibility;
  const scoreA = a.canonicalScore ?? -1;
  const scoreB = b.canonicalScore ?? -1;
  if (Math.abs(scoreA - scoreB) > 8) return scoreB - scoreA;
  const trust = trustRank(providerTrust(b)) - trustRank(providerTrust(a));
  if (trust !== 0) return trust;
  const age = ageDays(a.postedAt, now) - ageDays(b.postedAt, now);
  if (age !== 0) return age;
  return scoreB - scoreA;
}

function ageDays(postedAt: string | null, now: number): number {
  if (!postedAt) return 10_000;
  const posted = new Date(postedAt).getTime();
  if (Number.isNaN(posted)) return 10_000;
  return (now - posted) / 86_400_000;
}

export function rankDiscoveryJobs<T extends RankedDiscoveryJob>(jobs: T[], now = Date.now()): T[] {
  return [...jobs].sort((a, b) => compareDiscoveryRank(a, b, now));
}

export { SENIORITY_LEVELS, TRUST_BONUS };
