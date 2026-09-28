import { evaluateCanonicalMatch, type CanonicalProfile } from "@/features/jobs/matching/canonical-match";
import {
  classifyRemote,
  freshnessDecision,
  interpretSearchProfile,
  normalizeCountryCode,
  prepareDiscoveryCandidates,
  providerTrust,
  rankDiscoveryJobs,
  type DiscoveryQualityJob,
  type SearchIntent,
} from "@/features/jobs/discovery/quality/search-quality";
import { previewJobSignals } from "@/features/jobs/matching/canonical-match";
import type { JobDiscoveryProfileData } from "@/features/jobs/discovery/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-09-28T00:00:00.000Z").getTime();
const day = 86_400_000;

const baseIntent: SearchIntent = {
  preferredTitles: ["Backend Engineer", "Full-Stack Engineer"],
  excludedTitles: ["Sales Engineer", "Support Engineer", "Recruiter", "Journalist"],
  allowedSeniority: ["INTERN", "ENTRY", "JUNIOR", "MID"],
  excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
  preferredStack: ["TypeScript", "JavaScript", "Go", "React", "Next.js", "PostgreSQL", "Node.js"],
  avoidWhenMandatoryStack: ["C#", ".NET", "PHP", "Laravel"],
  locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
  currentCountryCode: "TR",
  currentCity: "Istanbul",
  selectedCountryCodes: [],
  remote: {
    worldwide: true,
    regions: ["EMEA"],
    acceptingCurrentCountry: true,
    acceptingSelectedCountries: false,
  },
  employmentTypes: ["FULL_TIME", "INTERNSHIP"],
  freshnessDays: 14,
  minimumTrust: "TIER_C",
  aggregatorsAllowed: true,
};

const profile: CanonicalProfile = {
  roleTargets: ["Backend Engineer", "Full-Stack Engineer"],
  experienceLevel: "Mid-Level",
  skills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go"],
  evidenceSkills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go"],
  countryCode: "TR",
  countryNames: ["Türkiye"],
  workModes: ["REMOTE"],
  searchTargetCountryCodes: ["TR"],
};

function job(partial: Partial<DiscoveryQualityJob> & Pick<DiscoveryQualityJob, "id" | "title">): DiscoveryQualityJob {
  return {
    company: partial.company ?? "Acme",
    location: partial.location ?? "Istanbul, Türkiye",
    countryCode: partial.countryCode ?? "TR",
    workMode: partial.workMode ?? "ONSITE",
    employmentType: partial.employmentType ?? "FULL_TIME",
    description: partial.description ?? "Required: TypeScript, Node.js, and PostgreSQL. Junior backend role with enough detail to evaluate search intent and eligibility.",
    postedAt: partial.postedAt ?? new Date(now - 2 * day).toISOString(),
    expiresAt: partial.expiresAt ?? null,
    sourceUrl: partial.sourceUrl ?? `https://example.com/jobs/${partial.id}`,
    applyUrl: partial.applyUrl ?? `https://example.com/jobs/${partial.id}`,
    provider: partial.provider ?? "REMOTIVE",
    externalId: partial.externalId ?? partial.id,
    ...partial,
  };
}

function keptIds(intent: SearchIntent, jobs: DiscoveryQualityJob[]) {
  return new Set(prepareDiscoveryCandidates(jobs, intent, now).kept.map((item) => item.id));
}

function withMode(patch: Partial<SearchIntent>): SearchIntent {
  return {
    ...baseIntent,
    ...patch,
    remote: { ...baseIntent.remote, ...patch.remote },
  };
}

assert(normalizeCountryCode("Türkiye") === "TR", "Türkiye normalizes to TR");
assert(normalizeCountryCode("USA") === "US", "USA normalizes to US");
assert(normalizeCountryCode("Deutschland") === "DE", "Deutschland normalizes to DE");
assert(normalizeCountryCode("The Netherlands") === "NL", "Netherlands normalizes to NL");
assert(normalizeCountryCode("UAE") === "AE", "UAE normalizes to AE");

const turkey = job({ id: "tr", title: "Junior Backend Engineer", location: "Istanbul, Türkiye", countryCode: "TR" });
const germany = job({ id: "de", title: "Backend Engineer", location: "Berlin, Germany", countryCode: "DE" });
const netherlands = job({ id: "nl", title: "Backend Engineer", location: "Amsterdam, Netherlands", countryCode: "NL" });
const france = job({ id: "fr", title: "Backend Engineer", location: "Paris, France", countryCode: "FR" });
const worldwide = job({
  id: "world",
  title: "Backend Engineer",
  location: "Remote worldwide",
  countryCode: null,
  workMode: "REMOTE",
  description: "Required: TypeScript and PostgreSQL. Junior backend. Remote worldwide.",
});
const usOnly = job({
  id: "us",
  title: "Backend Engineer",
  location: "Remote",
  countryCode: null,
  workMode: "REMOTE",
  description: "Required: TypeScript and PostgreSQL. Junior backend. US-only remote.",
});
const emea = job({
  id: "emea",
  title: "Backend Engineer",
  location: "Remote",
  countryCode: null,
  workMode: "REMOTE",
  description: "Required: TypeScript and PostgreSQL. Junior backend. Remote across EMEA.",
});

const current = withMode({ locationMode: "CURRENT_COUNTRY", remote: { ...baseIntent.remote, worldwide: false, regions: [] } });
let ids = keptIds(current, [turkey, germany, usOnly]);
assert(ids.has("tr") && !ids.has("de") && !ids.has("us"), "Case A current country");

const selected = withMode({
  locationMode: "SELECTED_COUNTRIES",
  selectedCountryCodes: ["DE", "NL"],
  remote: { ...baseIntent.remote, worldwide: false, acceptingSelectedCountries: false },
});
ids = keptIds(selected, [germany, netherlands, turkey, france]);
assert(ids.has("de") && ids.has("nl") && !ids.has("tr") && !ids.has("fr"), "Case B selected countries");

const remoteOnly = withMode({ locationMode: "REMOTE_ONLY" });
ids = keptIds(remoteOnly, [worldwide, usOnly, germany]);
assert(ids.has("world") && !ids.has("us") && !ids.has("germany") && !ids.has("de"), "Case C remote only");

const plus = withMode({ locationMode: "CURRENT_COUNTRY_PLUS_REMOTE" });
ids = keptIds(plus, [turkey, worldwide, emea, usOnly]);
assert(ids.has("tr") && ids.has("world") && ids.has("emea") && !ids.has("us"), "Case D current plus remote");

const selectedRemote = withMode({
  locationMode: "SELECTED_COUNTRIES_PLUS_REMOTE",
  selectedCountryCodes: ["DE", "NL"],
  remote: { ...baseIntent.remote, acceptingSelectedCountries: true, worldwide: false, regions: [] },
});
const deRemote = job({
  id: "de-remote",
  title: "Backend Engineer",
  location: "Remote",
  countryCode: null,
  workMode: "REMOTE",
  description: "Required: TypeScript and PostgreSQL. Junior backend. Germany only remote.",
});
ids = keptIds(selectedRemote, [germany, netherlands, deRemote, usOnly]);
assert(ids.has("de") && ids.has("nl") && ids.has("de-remote") && !ids.has("us"), "Case E selected plus remote");

const germanyMatch = evaluateCanonicalMatch(
  { title: germany.title, description: germany.description, location: germany.location, countryCode: "DE", workMode: "ONSITE" },
  { ...profile, searchTargetCountryCodes: ["DE", "NL"] },
);
assert(germanyMatch.eligibility !== "INELIGIBLE", "Germany search target is not a hard residence rejection");
assert(germanyMatch.score == null || typeof germanyMatch.score === "number", "M30B remains the only score");

const roleJobs = [
  job({ id: "backend", title: "Backend Engineer" }),
  job({ id: "full", title: "Full Stack Developer" }),
  job({ id: "soft", title: "Software Engineer - Backend" }),
  job({ id: "senior", title: "Senior Backend Engineer" }),
  job({ id: "news", title: "Tech Journalist", description: "Write technology news and interview founders. This is a journalism role with enough text." }),
  job({ id: "sales", title: "Sales Engineer", description: "Own the sales cycle, demos, and quota. This is a commercial sales role with enough text." }),
  job({ id: "recruit", title: "Recruiter", description: "Source candidates and manage hiring pipelines for engineering teams. This is a recruiting role." }),
  job({ id: "design", title: "Graphic Designer", description: "Design brand assets and marketing visuals for product launches. This is a design role." }),
  job({ id: "mobile", title: "Flutter Mobile Developer", description: "Build iOS and Android apps in Flutter. Mobile-only product work with enough detail." }),
];
ids = keptIds(baseIntent, roleJobs);
assert(ids.has("backend") && ids.has("full") && ids.has("soft"), "role targets included");
assert(!ids.has("senior") && !ids.has("news") && !ids.has("sales") && !ids.has("recruit") && !ids.has("design") && !ids.has("mobile"), "wrong roles and senior excluded");

const stackJobs = [
  job({ id: "ts", title: "Backend Engineer", company: "TS Co", description: "Required: TypeScript, Next.js, and PostgreSQL. Junior backend role." }),
  job({ id: "go", title: "Backend Engineer", company: "Go Co", description: "Required: Go and PostgreSQL. Junior backend role with enough detail." }),
  job({ id: "dotnet", title: "Backend Engineer", company: "Dot Co", description: "C# and ASP.NET are mandatory. Junior backend role with enough detail." }),
  job({ id: "php", title: "Backend Engineer", company: "Php Co", description: "PHP and Laravel are mandatory. Junior backend role with enough detail." }),
  job({ id: "docker", title: "Backend Engineer", company: "Docker Co", description: "Required: TypeScript and PostgreSQL. Junior backend. Docker is nice to have." }),
];
ids = keptIds(baseIntent, stackJobs);
assert(ids.has("ts") && ids.has("go") && ids.has("docker") && !ids.has("dotnet") && !ids.has("php"), `stack preferences kept ${[...ids].join(",")}`);

const contract = job({ id: "contract", title: "Backend Engineer", employmentType: "CONTRACT" });
assert(!keptIds(baseIntent, [contract]).has("contract"), "unselected employment type excluded");
assert(keptIds(baseIntent, [job({ id: "unknown-type", title: "Backend Engineer", employmentType: "UNKNOWN" })]).has("unknown-type"), "unknown employment kept");

const fresh = [
  job({ id: "d2", title: "Backend Engineer", postedAt: new Date(now - 2 * day).toISOString() }),
  job({ id: "d7", title: "Full-Stack Engineer", company: "Fresh Co", postedAt: new Date(now - 7 * day).toISOString() }),
  job({ id: "d14", title: "Backend Engineer", company: "Edge Co", postedAt: new Date(now - 14 * day).toISOString() }),
  job({ id: "d15", title: "Backend Engineer", company: "Old Co", postedAt: new Date(now - 15 * day).toISOString() }),
  job({ id: "d45", title: "Backend Engineer", company: "Stale Co", postedAt: new Date(now - 45 * day).toISOString() }),
  job({ id: "unknown-date", title: "Backend Engineer", company: "Undated Co", postedAt: null }),
  job({ id: "expired", title: "Backend Engineer", company: "Closed Co", expiresAt: new Date(now - day).toISOString() }),
];
ids = keptIds(baseIntent, fresh);
assert(ids.has("d2") && ids.has("d7") && ids.has("d14") && ids.has("unknown-date"), "fresh and unknown date kept");
assert(!ids.has("d15") && !ids.has("d45") && !ids.has("expired"), "stale and expired excluded");

const ats = job({
  id: "ats",
  title: "Backend Engineer",
  company: "Northwind",
  sourceUrl: "https://boards.greenhouse.io/northwind/jobs/1",
  applyUrl: "https://boards.greenhouse.io/northwind/jobs/1",
  provider: "ADZUNA",
});
const aggregator = job({
  id: "agg",
  title: "Backend Engineer",
  company: "Northwind",
  sourceUrl: "https://www.adzuna.com/details/1",
  applyUrl: "https://www.adzuna.com/land/1",
  provider: "ADZUNA",
  externalId: "agg-1",
});
const unknown = job({
  id: "unknown-source",
  title: "Backend Engineer",
  company: "Northwind",
  sourceUrl: "https://random-board.example/jobs/1",
  applyUrl: "https://random-board.example/jobs/1",
  provider: "UNKNOWN",
  externalId: "unknown-1",
});
const deduped = prepareDiscoveryCandidates([ats, aggregator, unknown], baseIntent, now);
assert(deduped.kept.length === 1 && deduped.kept[0].id === "ats", "official source wins duplicate group");
assert(providerTrust(ats) === "TIER_A" && providerTrust(unknown) === "TIER_C", "trust tiers");

const otherCompany = job({ id: "other", title: "Backend Engineer", company: "Other Co" });
const otherCity = job({ id: "izmir", title: "Backend Engineer", company: "Northwind", location: "Izmir, Türkiye", countryCode: "TR" });
assert(prepareDiscoveryCandidates([ats, otherCompany, otherCity], baseIntent, now).kept.length === 3, "different company or city is not a duplicate");

const emptyCountry = interpretSearchProfile({
  roleTargets: [{ title: "Backend Engineer", aliases: [], priority: "high", confidence: "strong", evidence: [], enabled: true }],
  locationTargets: [],
  workModes: [],
  employmentTypes: [],
  experienceLevels: [],
  includedKeywords: [],
  excludedKeywords: [],
  workAuthorization: {},
  visaPreference: null,
  freshnessDays: 14,
  minimumSuitabilityScore: 75,
  dailyTarget: 20,
  providerPreferences: {},
} satisfies JobDiscoveryProfileData);
assert(emptyCountry.currentCountryCode === null, "missing country stays missing");
assert(emptyCountry.remote.worldwide === false, "missing profile does not assume worldwide remote");

const benchmark: DiscoveryQualityJob[] = [];
for (let index = 0; index < 36; index++) {
  benchmark.push(job({
    id: `good-${index}`,
    title: index % 2 === 0 ? "Junior Backend Engineer" : "Full-Stack Engineer",
    company: `Good ${index}`,
    location: index % 3 === 0 ? "Remote worldwide" : "Istanbul, Türkiye",
    countryCode: index % 3 === 0 ? null : "TR",
    workMode: index % 3 === 0 ? "REMOTE" : "ONSITE",
    description: index % 3 === 0
      ? "Required: TypeScript, Node.js, and PostgreSQL. Junior backend. Remote worldwide."
      : "Required: TypeScript, Node.js, and PostgreSQL. Junior backend role in Istanbul.",
    postedAt: new Date(now - (index % 10) * day).toISOString(),
    provider: index % 4 === 0 ? "ADZUNA" : "REMOTIVE",
  }));
}
benchmark.push(
  job({ id: "bad-senior", title: "Senior Backend Engineer", company: "Senior Co" }),
  job({ id: "bad-staff", title: "Staff Engineer", company: "Staff Co", description: "Required: TypeScript and PostgreSQL. Staff engineer owning platform direction." }),
  job({ id: "bad-news", title: "Tech Journalist", company: "News Co", description: "Write technology news and interview founders. No software delivery and enough detail." }),
  job({ id: "bad-sales", title: "Sales Engineer", company: "Sales Co", description: "Own the sales cycle and quota. This is a commercial sales role with enough detail." }),
  job({ id: "bad-qa", title: "QA Engineer", company: "QA Co", description: "Quality assurance testing only. Manual and automated test ownership with enough detail." }),
  job({ id: "bad-support", title: "Support Engineer", company: "Support Co", description: "Customer support for the product. Troubleshoot tickets with enough detail." }),
  job({ id: "bad-mobile", title: "Flutter Mobile Developer", company: "Mobile Co", description: "Build iOS and Android apps in Flutter. Mobile-only work with enough detail." }),
  job({ id: "bad-dotnet", title: "Backend Engineer", company: "Dot Co", description: "C# and ASP.NET are mandatory. Junior backend role with enough detail." }),
  job({ id: "bad-php", title: "Backend Engineer", company: "Php Co", description: "PHP and Laravel are mandatory. Junior backend role with enough detail." }),
  job({ id: "bad-us", title: "Backend Engineer", company: "US Co", location: "Remote", countryCode: null, workMode: "REMOTE", description: "Required: TypeScript and PostgreSQL. Junior backend. US-only remote." }),
  job({ id: "bad-de", title: "Backend Engineer", company: "DE Co", location: "Berlin, Germany", countryCode: "DE" }),
  job({ id: "bad-stale", title: "Backend Engineer", company: "Stale Co", postedAt: new Date(now - 40 * day).toISOString() }),
  job({ id: "bad-expired", title: "Backend Engineer", company: "Expired Co", expiresAt: new Date(now - day).toISOString() }),
  job({ id: "dup", title: "Junior Backend Engineer", company: "Good 0", location: "Remote worldwide", countryCode: null, workMode: "REMOTE", description: "Required: TypeScript, Node.js, and PostgreSQL. Junior backend. Remote worldwide.", provider: "JOOBLE", externalId: "dup", sourceUrl: "https://jooble.org/j/dup", applyUrl: "https://jooble.org/j/dup" }),
);
assert(benchmark.length >= 50, `benchmark has ${benchmark.length} jobs`);

const prepared = prepareDiscoveryCandidates(benchmark, baseIntent, now);
const ranked = rankDiscoveryJobs(prepared.kept.map((item) => {
  const match = evaluateCanonicalMatch(
    { title: item.title, description: item.description, location: item.location, countryCode: item.countryCode, workMode: item.workMode },
    profile,
  );
  return { ...item, canonicalScore: match.score, eligibility: match.eligibility };
}), now).filter((item) => item.eligibility !== "INELIGIBLE");

const top20 = ranked.slice(0, 20);
const badTitle = /journalist|sales|recruiter|graphic|support engineer|qa engineer|flutter|senior|staff/i;
const badStack = /c#|asp\.net|\.net|php|laravel/i;
for (const item of top20) {
  assert(!badTitle.test(item.title), `top 20 unrelated or senior: ${item.title}`);
  assert(!badStack.test(item.description), `top 20 blocked stack: ${item.id}`);
  assert(item.id !== "bad-us" && item.id !== "bad-de" && item.id !== "bad-stale", `top 20 contains ${item.id}`);
  assert(item.eligibility === "ELIGIBLE" || item.eligibility === "REVIEW_REQUIRED", `top 20 eligibility ${item.eligibility}`);
}
const topIds = new Set(top20.map((item) => item.id));
assert(topIds.size === top20.length, "top 20 has a duplicate");
assert(!(topIds.has("good-0") && topIds.has("dup")), "duplicate group kept two results");
const relevant = top20.filter((item) => item.id.startsWith("good-") || item.id === "dup").length;
const precisionAt10 = top20.slice(0, 10).filter((item) => item.id.startsWith("good-") || item.id === "dup").length / 10;
const precisionAt20 = relevant / top20.length;
assert(precisionAt10 === 1, `precision@10 ${precisionAt10}`);
assert(precisionAt20 >= 0.95, `precision@20 ${precisionAt20}`);

async function reviewLive() {
  let realTop: Array<{ title: string; location: string | null; kept: boolean }> = [];
  try {
    const response = await fetch("https://remotive.com/api/remote-jobs?search=backend%20engineer&limit=100");
    if (response.ok) {
      const body = await response.json() as { jobs?: Array<Record<string, unknown>> };
      const live = (body.jobs ?? []).slice(0, 100).map((raw, index) => job({
        id: `live-${index}`,
        title: String(raw.title ?? "Untitled"),
        company: String(raw.company_name ?? "Unknown"),
        location: typeof raw.candidate_required_location === "string" ? raw.candidate_required_location : "Remote",
        countryCode: null,
        workMode: "REMOTE",
        description: String(raw.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 1500) || "Remote software role.",
        postedAt: typeof raw.publication_date === "string" ? raw.publication_date : null,
        sourceUrl: typeof raw.url === "string" ? raw.url : `https://remotive.com/remote-jobs/${index}`,
        applyUrl: typeof raw.url === "string" ? raw.url : null,
        provider: "REMOTIVE",
        externalId: raw.id != null ? String(raw.id) : `live-${index}`,
      }));
      const liveKept = prepareDiscoveryCandidates(live, baseIntent, Date.now()).kept;
      realTop = liveKept.slice(0, 10).map((item) => ({ title: item.title, location: item.location, kept: true }));
      const rejected = live.filter((item) => !liveKept.some((kept) => kept.id === item.id)).slice(0, 10).map((item) => ({
        title: item.title,
        location: item.location,
        seniority: previewJobSignals(item).seniority,
        role: previewJobSignals(item).roleFamily,
        remote: classifyRemote(item).scope,
        freshness: freshnessDecision(item, baseIntent, Date.now()),
      }));
      console.log(JSON.stringify({ liveFetched: live.length, liveKept: liveKept.length, rejected }));
    }
  } catch {
    realTop = [];
  }
  console.log(JSON.stringify({
    ok: true,
    benchmark: benchmark.length,
    kept: prepared.stats.kept,
    top20: top20.map((item) => item.id),
    precisionAt10,
    precisionAt20,
    stats: prepared.stats,
    realTop,
  }, null, 2));
}

reviewLive().catch((error) => {
  console.error(error);
  process.exit(1);
});
