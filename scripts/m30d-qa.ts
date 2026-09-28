import "dotenv/config";

import { evaluateCanonicalMatch, type CanonicalProfile } from "@/features/jobs/matching/canonical-match";
import { PROVIDER_CAPABILITIES, PROVIDER_FEATURES } from "@/features/jobs/discovery/providers/capabilities";
import { GREENHOUSE_BOARDS, LEVER_BOARDS, selectBoards } from "@/features/jobs/discovery/providers/boards";
import { executeProviderSearches } from "@/features/jobs/discovery/providers/execute-search";
import { EuresProvider } from "@/features/jobs/discovery/providers/eures";
import { GreenhouseProvider } from "@/features/jobs/discovery/providers/greenhouse";
import { LeverProvider } from "@/features/jobs/discovery/providers/lever";
import { getAllProviders, getProviderStatus } from "@/features/jobs/discovery/providers/registry";
import { countriesForProvider, planProviderSearch, titleVariants } from "@/features/jobs/discovery/providers/query-planner";
import { prepareDiscoveryCandidates, providerTrust, type DiscoveryQualityJob, type SearchIntent } from "@/features/jobs/discovery/quality/search-quality";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const description = "Required: TypeScript, Node.js, and PostgreSQL. This junior backend role is based in the listed city and includes enough detail for eligibility review.";

const intent = (overrides: Partial<SearchIntent> = {}): SearchIntent => ({
  preferredTitles: ["Backend Engineer", "Full-Stack Engineer"],
  excludedTitles: [],
  allowedSeniority: ["ENTRY", "JUNIOR", "MID"],
  excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
  preferredStack: [],
  avoidWhenMandatoryStack: [],
  locationMode: "CURRENT_COUNTRY",
  currentCountryCode: "TR",
  currentCity: "Istanbul",
  selectedCountryCodes: ["TR"],
  remote: { worldwide: false, regions: [], acceptingCurrentCountry: false, acceptingSelectedCountries: false },
  employmentTypes: ["FULL_TIME"],
  freshnessDays: 45,
  minimumTrust: "TIER_C",
  aggregatorsAllowed: true,
  ...overrides,
});

function job(overrides: Partial<DiscoveryQualityJob>): DiscoveryQualityJob {
  return {
    id: overrides.id ?? "job",
    title: overrides.title ?? "Junior Backend Engineer",
    company: overrides.company ?? "Northwind",
    location: overrides.location ?? "Istanbul, Türkiye",
    countryCode: overrides.countryCode ?? "TR",
    workMode: overrides.workMode ?? "ONSITE",
    employmentType: overrides.employmentType ?? "FULL_TIME",
    description: overrides.description ?? description,
    postedAt: overrides.postedAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? null,
    sourceUrl: overrides.sourceUrl ?? "https://jobs.example.com/1",
    applyUrl: overrides.applyUrl ?? "https://jobs.example.com/1",
    provider: overrides.provider ?? "LEVER",
    externalId: overrides.externalId ?? overrides.id ?? "job",
  };
}

function checkPlanner() {
  const titles = titleVariants(["Backend Engineer"]);
  assert(titles[0] === "Backend Engineer" && titles.includes("Backend Developer") && titles.includes("Software Engineer"), `title variants ${titles.join("|")}`);
  assert(titles.length <= 3, "title cap exceeded");
  assert(!titleVariants(["Engineer", "Backend Engineer"]).some((title) => title.toLowerCase() === "engineer"), "generic Engineer leaked");
  assert(selectBoards(LEVER_BOARDS, ["TR"], 4).map((board) => board.slug).join(",") === "iyzico,trendyol,insiderone", "Türkiye Lever routing");
  assert(selectBoards(LEVER_BOARDS, ["DE"], 4).length === 0, "Lever queried a non-Türkiye board");
  const europe = selectBoards(GREENHOUSE_BOARDS, ["DE", "NL"], 4).map((board) => board.slug);
  assert(europe.includes("n26") && europe.includes("adyen") && europe.includes("hellofresh") && !europe.includes("dreamgames"), `Europe boards ${europe.join(",")}`);
  assert(selectBoards(GREENHOUSE_BOARDS, ["TR"], 4).every((board) => board.slug === "dreamgames"), "Türkiye Greenhouse routing");
  const turkey = intent();
  assert(planProviderSearch("EURES", turkey, false).reason === "unsupported_target", "EURES ran for Türkiye");
  assert(planProviderSearch("LEVER", turkey, false).execute, "Lever skipped Türkiye");
  assert(planProviderSearch("REMOTIVE", turkey, false).reason === "remote_not_requested", "Remotive ran without remote");
  assert(planProviderSearch("LINKEDIN", turkey, true).reason === "not_runnable", "LinkedIn discovery ran");
  assert(planProviderSearch("ASHBY", turkey, true).reason === "not_runnable", "Ashby discovery ran");
  const europeIntent = intent({ locationMode: "SELECTED_COUNTRIES", selectedCountryCodes: ["DE", "NL", "FR", "AT"], currentCountryCode: "TR" });
  assert(countriesForProvider("EURES", europeIntent).join(",") === "DE,NL,FR", `EURES country cap ${countriesForProvider("EURES", europeIntent).join(",")}`);
  assert(PROVIDER_FEATURES.LEVER.requiresApiKey === false && PROVIDER_FEATURES.LEVER.supportsKeywordQuery === false, "Lever capabilities overstated");
  assert(PROVIDER_FEATURES.LINKEDIN.maxResults === 0 && PROVIDER_CAPABILITIES.LINKEDIN.availability === "partner_access_required", "LinkedIn capability invented");
  assert(!getAllProviders().some((provider) => provider.provider === "LINKEDIN" || provider.provider === "ASHBY"), "gated provider is executable");
}

async function checkAdapters() {
  const lever = new LeverProvider(async () => Response.json([
    { id: "bad", text: "", descriptionPlain: description, hostedUrl: "https://jobs.lever.co/iyzico/bad", categories: { location: "Istanbul" } },
    { id: "good", text: "Junior Backend Engineer", descriptionPlain: description, hostedUrl: "https://jobs.lever.co/iyzico/good", applyUrl: "https://jobs.lever.co/iyzico/good", createdAt: Date.now(), categories: { location: "Istanbul, Turkiye", commitment: "Full-time" }, workplaceType: "on-site" },
    { id: "us", text: "Junior Backend Engineer", descriptionPlain: description, hostedUrl: "https://jobs.lever.co/iyzico/us", categories: { location: "New York" } },
  ]));
  const leverJobs = await lever.search({ keywords: ["Backend Engineer"], countryCodes: ["TR"] });
  assert(leverJobs.length > 0 && leverJobs.every((item) => item.externalId === "good" && item.countryCode === "TR"), "Lever normalization failed");
  assert(leverJobs[0].postedAt != null && leverJobs[0].remote === false, "Lever metadata lost");

  const greenhouse = new GreenhouseProvider(async () => Response.json({
    jobs: [{ id: 7, title: "Backend Engineer", absolute_url: "https://boards.greenhouse.io/n26/jobs/7", location: { name: "Berlin, Germany" }, content: `<p>${description}</p>`, updated_at: new Date().toISOString() }],
  }));
  const greenhouseJobs = await greenhouse.search({ keywords: ["Backend Engineer"], countryCodes: ["DE"] });
  assert(greenhouseJobs.length > 0 && greenhouseJobs.every((item) => item.provider === "GREENHOUSE" && item.countryCode === "DE"), "Greenhouse normalization failed");

  const eures = new EuresProvider(async () => Response.json({
    jvs: [{
      id: "eures-1",
      title: "Senior Salesforce Consultant",
      description: description,
      creationDate: Date.now(),
      employer: { name: "Example GmbH" },
      locationMap: { city: "Berlin" },
    }],
  }));
  const euresJobs = await eures.search({ keywords: ["Software Engineer"], countryCodes: ["DE"] });
  assert(euresJobs.length > 0 && euresJobs.every((item) => item.company === "Example GmbH" && item.postedAt != null), "EURES normalization failed");
  const filtered = prepareDiscoveryCandidates(euresJobs.map((item, index) => ({
    id: item.externalId ?? String(index),
    title: item.title,
    company: item.company,
    location: item.location,
    countryCode: item.countryCode,
    workMode: item.workMode,
    employmentType: item.employmentType,
    description: item.description,
    postedAt: item.postedAt,
    expiresAt: item.expiresAt,
    sourceUrl: item.sourceUrl,
    applyUrl: item.applyUrl,
    provider: item.provider,
    externalId: item.externalId,
  })), intent({ locationMode: "SELECTED_COUNTRIES", selectedCountryCodes: ["DE"], currentCountryCode: "TR" }));
  assert(filtered.stats.seniorityFiltered + filtered.stats.roleFiltered > 0 || filtered.kept.length === 0, "EURES misleading title bypassed M30C");

  const limited = new LeverProvider(async () => new Response("no", { status: 429 }));
  const healthy = new GreenhouseProvider(async () => Response.json({
    jobs: [{ id: 1, title: "Junior Backend Engineer", absolute_url: "https://boards.greenhouse.io/dreamgames/jobs/1", location: { name: "Istanbul, Türkiye" }, content: `<p>${description}</p>`, updated_at: new Date().toISOString() }],
  }));
  const collected = await executeProviderSearches({
    providers: [limited, healthy],
    enabled: [limited, healthy],
    intent: intent(),
    remoteWanted: false,
  });
  assert(collected.stats.some((item) => item.provider === "LEVER" && item.status === "rate_limited"), "Lever rate limit was not isolated");
  assert(collected.results.some((item) => item.provider === "GREENHOUSE"), "Greenhouse stopped after Lever failed");
}

function checkQuality() {
  const official = job({ id: "official", provider: "LEVER", sourceUrl: "https://jobs.lever.co/iyzico/1", applyUrl: "https://jobs.lever.co/iyzico/1" });
  const aggregator = job({ id: "agg", provider: "ADZUNA", sourceUrl: "https://www.adzuna.com/land/1", applyUrl: "https://www.adzuna.com/land/1", externalId: "agg" });
  const otherCity = job({ id: "ankara", location: "Ankara, Türkiye", externalId: "ankara" });
  const deduped = prepareDiscoveryCandidates([aggregator, official, otherCity], intent());
  assert(deduped.kept.some((item) => item.id === "official") && !deduped.kept.some((item) => item.id === "agg"), "official Lever source did not win");
  assert(deduped.kept.some((item) => item.id === "ankara"), "different city was collapsed");
  assert(providerTrust(official) === "TIER_A" && providerTrust({ ...official, provider: "EURES", sourceUrl: "https://europa.eu/eures/job/1", applyUrl: null }) === "TIER_B", "trust mapping changed");
  const bareRemote = job({ id: "remote", workMode: "REMOTE", location: "Remote", countryCode: null, remote: null } as Partial<DiscoveryQualityJob>);
  const remoteResult = prepareDiscoveryCandidates([bareRemote], intent({
    locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
    remote: { worldwide: true, regions: ["EMEA"], acceptingCurrentCountry: true, acceptingSelectedCountries: false },
  }));
  assert(!remoteResult.kept.some((item) => item.id === "remote"), "bare remote became eligible");
  const marketingCopy = job({
    id: "marketing-worldwide",
    title: "Software Engineer",
    location: "Turkey",
    countryCode: "TR",
    workMode: "REMOTE",
    description: "We make technology accessible to marketers worldwide. This software engineer role is remote from Turkey and includes TypeScript and PostgreSQL.",
    sourceUrl: "https://jobs.lever.co/insiderone/ai",
    applyUrl: "https://jobs.lever.co/insiderone/ai",
  });
  const marketingResult = prepareDiscoveryCandidates([marketingCopy], intent({
    locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
    remote: { worldwide: true, regions: ["EMEA"], acceptingCurrentCountry: true, acceptingSelectedCountries: false },
  }));
  assert(!marketingResult.kept.some((item) => item.id === "marketing-worldwide"), "company-wide worldwide copy became a worldwide role");

  const good = Array.from({ length: 20 }, (_, index) => job({
    id: `good-${index}`,
    externalId: `good-${index}`,
    company: `Company ${index}`,
    sourceUrl: `https://jobs.example.com/${index}`,
    applyUrl: `https://jobs.example.com/${index}`,
  }));
  const bad = [
    job({ id: "bad-senior", title: "Senior Backend Engineer", externalId: "bad-senior", sourceUrl: "https://jobs.example.com/senior", applyUrl: "https://jobs.example.com/senior" }),
    job({ id: "bad-sales", title: "Account Executive", externalId: "bad-sales", sourceUrl: "https://jobs.example.com/sales", applyUrl: "https://jobs.example.com/sales" }),
    job({ id: "bad-geo", countryCode: "US", location: "Austin, United States", externalId: "bad-geo", sourceUrl: "https://jobs.example.com/geo", applyUrl: "https://jobs.example.com/geo" }),
    job({ id: "bad-stack", description: `${description} C# and .NET are mandatory.`, externalId: "bad-stack", sourceUrl: "https://jobs.example.com/stack", applyUrl: "https://jobs.example.com/stack" }),
    job({ id: "bad-stale", postedAt: "2020-01-01T00:00:00.000Z", externalId: "bad-stale", sourceUrl: "https://jobs.example.com/stale", applyUrl: "https://jobs.example.com/stale" }),
  ];
  const ranked = prepareDiscoveryCandidates([...good, ...bad], intent({ avoidWhenMandatoryStack: ["C#", ".NET"] }));
  const top10 = ranked.kept.slice(0, 10);
  const top20 = ranked.kept.slice(0, 20);
  assert(top10.length === 10 && top10.every((item) => item.id.startsWith("good")), "Precision@10 dropped");
  assert(top20.length === 20 && top20.every((item) => item.id.startsWith("good")), "Precision@20 dropped");
  assert(!ranked.kept.some((item) => item.id.startsWith("bad")), "bad jobs survived M30C");
  const unrelated = prepareDiscoveryCandidates([
    job({
      id: "recipe",
      title: "Junior Recipe Developer",
      company: "HelloFresh",
      location: "Berlin, Germany",
      countryCode: "DE",
      description: "Develop new recipes for meal kits and manage kitchen trials. This culinary role includes enough detail for review.",
      sourceUrl: "https://boards.greenhouse.io/hellofresh/jobs/recipe",
      applyUrl: "https://boards.greenhouse.io/hellofresh/jobs/recipe",
      provider: "GREENHOUSE",
    }),
    job({
      id: "field",
      title: "Field Service Engineer",
      company: "Example GmbH",
      location: "Germany",
      countryCode: "DE",
      description: "Install and repair network hardware on customer sites. This field service role includes enough detail for review.",
      sourceUrl: "https://europa.eu/eures/portal/jv-se/jv-details/field",
      applyUrl: "https://europa.eu/eures/portal/jv-se/jv-details/field",
      provider: "EURES",
    }),
  ], intent({ locationMode: "SELECTED_COUNTRIES", selectedCountryCodes: ["DE"], currentCountryCode: "TR" }));
  assert(unrelated.kept.length === 0, "unrelated engineer or developer titles survived");

  const profile: CanonicalProfile = {
    roleTargets: ["Backend Engineer", "Software Engineer", "Full-Stack Engineer"],
    experienceLevel: "Mid-Level",
    skills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    evidenceSkills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    countryCode: "TR",
    countryNames: ["Türkiye", "Istanbul"],
    workModes: ["REMOTE"],
  };
  const canonical = evaluateCanonicalMatch({
    title: "Junior Backend Engineer",
    location: "Istanbul, Türkiye",
    description,
  }, profile);
  assert(canonical.eligibility === "ELIGIBLE" && canonical.band === "STRONG" && canonical.score != null, "M30B result changed");
  assert(getProviderStatus().find((item) => item.provider === "LINKEDIN")?.status === "partner_access_required", "LinkedIn status changed");
}

async function checkLive() {
  const lever = await new LeverProvider().search({ keywords: ["Backend Engineer", "Full-Stack Engineer", "Software Engineer"], countryCodes: ["TR"] });
  const greenhouseTr = await new GreenhouseProvider().search({ keywords: ["Software Engineer"], countryCodes: ["TR"] });
  const greenhouseEu = await new GreenhouseProvider().search({ keywords: ["Backend Engineer"], countryCodes: ["DE", "NL"] });
  const eures = await new EuresProvider().search({ keywords: ["Software Engineer"], countryCodes: ["DE", "NL"] });
  assert(lever.length > 0, "live Lever Türkiye returned no usable jobs");
  assert(greenhouseEu.length > 0, "live Greenhouse Europe returned no usable jobs");
  assert(eures.length > 0, "live EURES returned no usable jobs");
  const turkeyIntent = intent({
    preferredTitles: ["Backend Engineer", "Full-Stack Engineer", "Software Engineer"],
    allowedSeniority: ["ENTRY", "JUNIOR", "MID"],
  });
  const turkeyKept = prepareDiscoveryCandidates(lever.concat(greenhouseTr).map((item, index) => ({
    id: `${item.provider}:${item.externalId ?? index}`,
    title: item.title,
    company: item.company,
    location: item.location,
    countryCode: item.countryCode,
    workMode: item.workMode,
    employmentType: item.employmentType,
    description: item.description,
    postedAt: item.postedAt,
    expiresAt: item.expiresAt,
    sourceUrl: item.sourceUrl,
    applyUrl: item.applyUrl,
    provider: item.provider,
    externalId: item.externalId,
  })), turkeyIntent);
  console.log(JSON.stringify({
    live: {
      lever: lever.length,
      greenhouseTr: greenhouseTr.length,
      greenhouseEu: greenhouseEu.length,
      eures: eures.length,
      turkeyKept: turkeyKept.stats.kept,
      turkeyTop: turkeyKept.kept.slice(0, 10).map((item) => ({ title: item.title, company: item.company, location: item.location, provider: item.provider })),
      euresTop: eures.slice(0, 5).map((item) => ({ title: item.title, company: item.company, location: item.location })),
    },
  }, null, 2));
}

async function main() {
  checkPlanner();
  await checkAdapters();
  checkQuality();
  await checkLive();
  console.log("m30d:qa PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
