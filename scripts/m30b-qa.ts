import { evaluateCanonicalMatch, canAutoQueue, canManuallyQueue, type CanonicalProfile } from "@/features/jobs/matching/canonical-match";
import { calculateDeterministicScore } from "@/features/jobs/discovery/scoring/deterministic-score";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const profile: CanonicalProfile = {
  roleTargets: ["Backend Engineer", "Software Engineer", "Full-Stack Engineer"],
  experienceLevel: "Mid-Level",
  skills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
  evidenceSkills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
  countryCode: "TR",
  countryNames: ["Türkiye", "Istanbul"],
  workModes: ["REMOTE"],
};

const long = (text: string) => `${text} This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.`;

function check(
  name: string,
  job: { title: string; description: string; location: string | null },
  expect: {
    eligibility: string;
    band?: string;
    reasons?: string[];
    notReasons?: string[];
  },
) {
  const result = evaluateCanonicalMatch(job, profile);
  assert(result.eligibility === expect.eligibility, `${name} eligibility ${result.eligibility} reasons ${result.blockingReasons.join(",")}`);
  if (expect.band) assert(result.band === expect.band, `${name} band ${result.band} score ${result.score}`);
  for (const reason of expect.reasons ?? []) {
    assert(result.blockingReasons.includes(reason as never), `${name} missing ${reason}; got ${result.blockingReasons.join(",")}`);
  }
  for (const reason of expect.notReasons ?? []) {
    assert(!result.blockingReasons.includes(reason as never), `${name} unexpectedly has ${reason}`);
  }
  if (result.eligibility === "INELIGIBLE") {
    assert(result.score === null, `${name} ineligible score must be null`);
    assert(result.band === "INELIGIBLE", `${name} ineligible band`);
    assert(!canAutoQueue(result) && !canManuallyQueue(result), `${name} must not enter the queue`);
  }
  if (result.eligibility === "REVIEW_REQUIRED") {
    assert(result.band !== "STRONG", `${name} review must not be Strong`);
    assert(!canAutoQueue(result), `${name} review must not auto-queue`);
    assert(canManuallyQueue(result), `${name} review can be queued explicitly`);
  }
  return result;
}

const juniorBackend = check("case1", {
  title: "Junior Backend Engineer",
  location: "Istanbul, Türkiye",
  description: long("Required: TypeScript, Node.js, and PostgreSQL. Junior backend role. Onsite in Istanbul."),
}, { eligibility: "ELIGIBLE", band: "STRONG" });

check("case2", {
  title: "Full-Stack Engineer",
  location: "Remote",
  description: long("Required: React, Next.js, and TypeScript. Remote worldwide."),
}, { eligibility: "ELIGIBLE" });

const dotnet = check("case3", {
  title: "Senior .NET Developer",
  location: "Remote",
  description: long("C# and ASP.NET are mandatory. 5+ years of commercial .NET experience. Senior role."),
}, {
  eligibility: "INELIGIBLE",
  reasons: ["CORE_STACK_MISMATCH", "SENIORITY_MISMATCH", "EXPERIENCE_MISMATCH"],
  notReasons: ["ROLE_FAMILY_MISMATCH"],
});

check("case3b", {
  title: "Senior .NET",
  location: "Remote",
  description: long("C# and ASP.NET are mandatory. 5+ years of commercial .NET experience. Senior role."),
}, {
  eligibility: "INELIGIBLE",
  reasons: ["CORE_STACK_MISMATCH", "SENIORITY_MISMATCH", "EXPERIENCE_MISMATCH"],
  notReasons: ["ROLE_FAMILY_MISMATCH"],
});

check("case4", {
  title: "Staff Engineer",
  location: "Istanbul, Türkiye",
  description: long("Required: TypeScript and PostgreSQL. Staff engineer owning platform direction."),
}, { eligibility: "INELIGIBLE", reasons: ["SENIORITY_MISMATCH"] });

check("case5", {
  title: "Tech Journalist",
  location: "Istanbul, Türkiye",
  description: long("Write technology news and interview founders. No software delivery."),
}, { eligibility: "INELIGIBLE", reasons: ["ROLE_FAMILY_MISMATCH"] });

check("case6", {
  title: "Sales Engineer",
  location: "Istanbul, Türkiye",
  description: long("Own the sales cycle, demos, and quota. This is a commercial sales role."),
}, { eligibility: "INELIGIBLE", reasons: ["ROLE_FAMILY_MISMATCH"] });

check("case7", {
  title: "Backend Engineer",
  location: "Remote",
  description: long("Required: TypeScript and PostgreSQL. Junior backend. US-only remote."),
}, { eligibility: "INELIGIBLE", reasons: ["LOCATION_INELIGIBLE"] });

check("case8", {
  title: "Backend Engineer",
  location: "Remote",
  description: long("Required: TypeScript and PostgreSQL. Junior backend. Europe remote, country eligibility is not stated."),
}, { eligibility: "REVIEW_REQUIRED", reasons: ["UNKNOWN_LOCATION_POLICY"] });

check("case9", {
  title: "Backend Engineer",
  location: "Istanbul, Türkiye",
  description: long("Required: TypeScript, Node.js, and PostgreSQL. Junior backend in Istanbul. Docker is nice to have."),
}, { eligibility: "ELIGIBLE", notReasons: ["CORE_STACK_MISMATCH"] });

check("case10", {
  title: "Backend Engineer",
  location: null,
  description: "Backend role.",
}, { eligibility: "REVIEW_REQUIRED", reasons: ["INSUFFICIENT_JOB_DATA"] });

const discovery = calculateDeterministicScore({
  jobTitle: "Senior .NET Developer",
  jobDescription: long("C# and ASP.NET are mandatory. 5+ years of commercial .NET experience. Senior role."),
  jobLocation: "Remote",
  jobCountryCode: null,
  jobWorkMode: "REMOTE",
  jobEmploymentType: "FULL_TIME",
  jobPostedAt: null,
  roleTargets: profile.roleTargets.map((title) => ({
    title,
    aliases: [],
    priority: "high" as const,
    confidence: "strong" as const,
    evidence: [],
    enabled: true,
  })),
  locationTargets: [{ countryCode: "TR", country: "Türkiye", cities: ["Istanbul"], enabled: true }],
  userWorkModes: ["REMOTE"],
  userEmploymentTypes: [],
  userExperienceLevel: "Mid-Level",
  userSkills: profile.skills,
  userEvidenceSkills: profile.evidenceSkills,
  freshnessDays: 14,
});

assert(discovery.canonical.band === dotnet.band, "discovery and canonical band diverge");
assert(discovery.canonical.score === dotnet.score, "discovery and canonical score diverge");
assert(discovery.hardBlockers.join(",") === dotnet.blockingReasons.join(","), "discovery blockers diverge");
assert(juniorBackend.score != null && juniorBackend.score >= 75, "junior backend should score at least 75");
assert(dotnet.score === null && juniorBackend.score !== 79, "ineligible score must not be a strong number");

console.log(JSON.stringify({
  ok: true,
  juniorBackend: { eligibility: juniorBackend.eligibility, band: juniorBackend.band, score: juniorBackend.score },
  dotnet: { eligibility: dotnet.eligibility, band: dotnet.band, reasons: dotnet.blockingReasons },
}, null, 2));
