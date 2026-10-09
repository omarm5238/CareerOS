import "dotenv/config";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DiscoveryProvider } from "@/generated/prisma/enums";
import { evaluateCanonicalMatch, type CanonicalProfile } from "@/features/jobs/matching/canonical-match";
import { PROVIDER_LABELS } from "@/features/jobs/discovery/constants";
import { parseDiscoveryProfileData, parseProviderPreferences } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { PROVIDER_CAPABILITIES } from "@/features/jobs/discovery/providers/capabilities";
import { getAllProviders, getEnabledProviders, getProviderStatus } from "@/features/jobs/discovery/providers/registry";
import { prepareDiscoveryCandidates, providerTrust, type DiscoveryQualityJob, type SearchIntent } from "@/features/jobs/discovery/quality/search-quality";
import { DISCOVERY_PROVIDER_NAMES, type DiscoveryProviderName } from "@/features/jobs/discovery/types";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const EXPECTED: DiscoveryProviderName[] = [
  "REMOTIVE",
  "ARBEITNOW",
  "ADZUNA",
  "JOOBLE",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
  "EURES",
  "LINKEDIN",
];

function checkEnumIdentity() {
  assert(DISCOVERY_PROVIDER_NAMES.length === 9, "provider name list must contain 9 values");
  assert(EXPECTED.every((name, index) => DISCOVERY_PROVIDER_NAMES[index] === name), "provider name order drifted");
  for (const name of EXPECTED) {
    assert(DiscoveryProvider[name] === name, `generated enum missing ${name}`);
    assert(PROVIDER_LABELS[name], `missing label ${name}`);
    assert(PROVIDER_CAPABILITIES[name]?.provider === name, `missing capability ${name}`);
  }
}

function checkInactiveProviders() {
  const runnable = getAllProviders().map((provider) => provider.provider);
  for (const name of ["REMOTIVE", "ARBEITNOW", "ADZUNA", "JOOBLE", "LEVER", "GREENHOUSE", "EURES"]) {
    assert(runnable.includes(name as never), `${name} missing from provider registry`);
  }
  assert(!runnable.includes("ASHBY") && !runnable.includes("LINKEDIN"), "gated providers were executed");
  const disabled = getEnabledProviders({ LEVER: false, GREENHOUSE: false, EURES: false }).map((provider) => provider.provider);
  assert(!disabled.some((name) => name === "LEVER" || name === "GREENHOUSE" || name === "EURES"), "disabled providers still ran");
  const status = new Map(getProviderStatus().map((item) => [item.provider, item]));
  assert(status.get("ASHBY")?.status === "unsupported", "Ashby must stay inactive");
  assert(PROVIDER_CAPABILITIES.ASHBY.adapterImplemented === false, "Ashby adapter must not exist");
  assert(status.get("LINKEDIN")?.status === "partner_access_required", "LinkedIn must stay partner-gated");
  assert(PROVIDER_CAPABILITIES.LINKEDIN.runnable === false, "LinkedIn must not be runnable");
  assert(status.get("REMOTIVE")?.status === "available", "Remotive availability changed");
  assert(status.get("ARBEITNOW")?.status === "available", "Arbeitnow availability changed");
}

function checkPreferences() {
  const parsed = parseProviderPreferences({
    REMOTIVE: true,
    ARBEITNOW: false,
    ADZUNA: true,
    JOOBLE: false,
    searchIntent: { preferredTitles: ["Backend Engineer"] },
  });
  assert(parsed.REMOTIVE === true && parsed.ARBEITNOW === false, "old preferences failed to parse");
  assert(parsed.ADZUNA === true && parsed.JOOBLE === false, "old Adzuna/Jooble preferences failed");
  assert(parsed.GREENHOUSE === undefined && parsed.LINKEDIN === undefined, "new providers were auto-enabled");
  const profile = parseDiscoveryProfileData({
    roleTargetsJson: [],
    locationTargetsJson: [],
    workModesJson: [],
    employmentTypesJson: [],
    experienceLevelsJson: [],
    includedKeywordsJson: [],
    excludedKeywordsJson: [],
    workAuthorizationJson: {},
    visaPreference: null,
    freshnessDays: 14,
    minimumSuitabilityScore: 55,
    dailyTarget: 5,
    providerPreferencesJson: { REMOTIVE: true, ARBEITNOW: true, searchIntent: { locationMode: "CURRENT_COUNTRY" } },
  });
  assert(profile.providerPreferences.REMOTIVE === true, "profile preference dropped Remotive");
  assert(profile.providerPreferences.GREENHOUSE === undefined, "profile auto-enabled Greenhouse");
  assert(profile.searchIntent?.locationMode === "CURRENT_COUNTRY", "search intent was dropped");
}

function checkMatchingUnchanged() {
  const profile: CanonicalProfile = {
    roleTargets: ["Backend Engineer", "Software Engineer", "Full-Stack Engineer"],
    experienceLevel: "Mid-Level",
    skills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    evidenceSkills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    countryCode: "TR",
    countryNames: ["Türkiye", "Istanbul"],
    workModes: ["REMOTE"],
  };
  const description = "Required: TypeScript, Node.js, and PostgreSQL. Junior backend role. Onsite in Istanbul. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.";
  const result = evaluateCanonicalMatch({
    title: "Junior Backend Engineer",
    location: "Istanbul, Türkiye",
    description,
  }, profile);
  assert(result.eligibility === "ELIGIBLE" && result.band === "STRONG" && result.score != null, "M30B junior backend result changed");

  const intent: SearchIntent = {
    preferredTitles: ["Backend Engineer"],
    excludedTitles: [],
    allowedSeniority: ["ENTRY", "JUNIOR"],
    excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
    preferredStack: [],
    avoidWhenMandatoryStack: [],
    locationMode: "CURRENT_COUNTRY",
    currentCountryCode: "TR",
    currentCity: null,
    selectedCountryCodes: ["TR"],
    remote: { worldwide: false, regions: [], acceptingCurrentCountry: false, acceptingSelectedCountries: false },
    employmentTypes: ["FULL_TIME"],
    freshnessDays: 30,
    minimumTrust: "TIER_C",
    aggregatorsAllowed: true,
  };
  const junior: DiscoveryQualityJob = {
    id: "junior",
    title: "Junior Backend Engineer",
    company: "Northwind",
    location: "Istanbul, Türkiye",
    countryCode: "TR",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    description,
    postedAt: new Date().toISOString(),
    expiresAt: null,
    sourceUrl: "https://example.com/jobs/junior",
    applyUrl: "https://example.com/jobs/junior",
    provider: "ARBEITNOW",
    externalId: "junior",
  };
  const senior: DiscoveryQualityJob = { ...junior, id: "senior", title: "Senior Backend Engineer", externalId: "senior" };
  const prepared = prepareDiscoveryCandidates([junior, senior], intent);
  assert(prepared.kept.length === 1 && prepared.kept[0].id === "junior", "M30C seniority filter changed");
  assert(providerTrust({ provider: "ADZUNA", sourceUrl: "https://boards.greenhouse.io/acme/jobs/1", applyUrl: null }) === "TIER_A", "official URL trust changed");
  assert(providerTrust({ provider: "GREENHOUSE", sourceUrl: "https://example.com/jobs/1", applyUrl: null }) === "TIER_A", "Greenhouse identity trust");
  assert(providerTrust({ provider: "EURES", sourceUrl: "https://example.com/jobs/1", applyUrl: null }) === "TIER_B", "EURES trust");
  assert(providerTrust({ provider: "LINKEDIN", sourceUrl: "https://example.com/jobs/1", applyUrl: null }) === "TIER_C", "LinkedIn trust must not imply a trusted discovery source");
  assert(providerTrust({ provider: "UNKNOWN", sourceUrl: "https://random-board.example/jobs/1", applyUrl: null }) === "TIER_C", "unknown trust changed");
}

async function providerCounts() {
  const rows = await prisma.discoveredJobSource.groupBy({
    by: ["provider"],
    _count: { _all: true },
  });
  return rows.map((row) => `${row.provider}:${row._count._all}`).sort().join("|");
}

async function checkPersistence() {
  const before = await providerCounts();
  const existing = await prisma.discoveredJobSource.findFirst({
    select: { id: true, provider: true, sourceMetadataJson: true },
  });
  if (existing) {
    assert(
      existing.provider === "REMOTIVE" || existing.provider === "ARBEITNOW" || existing.provider === "ADZUNA" || existing.provider === "JOOBLE",
      `existing source has unexpected provider ${existing.provider}`,
    );
    const reread = await prisma.discoveredJobSource.findUnique({ where: { id: existing.id } });
    assert(reread?.provider === existing.provider, "existing provider failed to reload");
    assert(JSON.stringify(reread?.sourceMetadataJson) === JSON.stringify(existing.sourceMetadataJson), "existing source metadata changed");
  }

  const email = `m30d1-${Date.now()}@careeros.local`;
  const providers: DiscoveryProviderName[] = ["REMOTIVE", "GREENHOUSE", "LEVER", "ASHBY", "EURES", "LINKEDIN"];
  try {
    const user = await prisma.user.create({ data: { name: "M30D1 Enum", email } });
    const job = await prisma.discoveredJob.create({
      data: {
        userId: user.id,
        title: "Enum persistence check",
        normalizedTitle: "enum persistence check",
        company: "CareerOS QA",
        normalizedCompany: "careeros qa",
        description: "Disposable provider enum round-trip. This row is deleted before the test exits.",
        canonicalFingerprint: `m30d1-${user.id}`,
      },
    });
    for (const provider of providers) {
      const created = await prisma.discoveredJobSource.create({
        data: {
          discoveredJobId: job.id,
          provider,
          externalId: provider,
          sourceUrl: `https://example.com/m30d1/${provider}`,
        },
      });
      const loaded = await prisma.discoveredJobSource.findUnique({ where: { id: created.id } });
      assert(loaded?.provider === provider, `${provider} did not round-trip`);
    }
    const enumRange = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT unnest(enum_range(NULL::"DiscoveryProvider"))::text AS value
    `;
    const values = enumRange.map((row) => row.value);
    assert(EXPECTED.every((name) => values.includes(name)), `database enum missing values: ${values.join(",")}`);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }

  const after = await providerCounts();
  assert(before === after, `provider rows changed: before ${before} after ${after}`);
  const leftover = await prisma.user.findUnique({ where: { email } });
  assert(leftover == null, "test user was left behind");
}

function checkMigrationFile() {
  const root = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(dirs.length >= 22, `expected at least the 22 pre-M32 migrations, found ${dirs.length}`);
  const match = dirs.find((entry) => entry.name.endsWith("_add_discovery_providers"));
  assert(match, "add_discovery_providers migration is missing");
  const sql = readFileSync(join(root, match.name, "migration.sql"), "utf8");
  for (const name of ["GREENHOUSE", "LEVER", "ASHBY", "EURES", "LINKEDIN"]) {
    assert(sql.includes(`ADD VALUE '${name}'`), `migration missing ${name}`);
  }
  assert(!/DROP|DELETE|TRUNCATE|UPDATE|CREATE TABLE|ALTER TABLE/i.test(sql), "migration is not additive");
}

async function main() {
  checkEnumIdentity();
  checkInactiveProviders();
  checkPreferences();
  checkMatchingUnchanged();
  checkMigrationFile();
  await checkPersistence();
  console.log("m30d1:qa PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
