/** Identity of the M30B scoring rules. Opportunity snapshots record this; they do not rescore. */
export const CANONICAL_MATCH_VERSION = "m30b-canonical-v1";

export const BLOCKING_REASONS = [
  "ROLE_FAMILY_MISMATCH",
  "SENIORITY_MISMATCH",
  "CORE_STACK_MISMATCH",
  "LOCATION_INELIGIBLE",
  "EXPERIENCE_MISMATCH",
  "UNKNOWN_LOCATION_POLICY",
  "UNKNOWN_SENIORITY",
  "INSUFFICIENT_JOB_DATA",
] as const;

export type BlockingReason = (typeof BLOCKING_REASONS)[number];

export type MatchEligibility = "ELIGIBLE" | "INELIGIBLE" | "REVIEW_REQUIRED";
export type MatchBand = "STRONG" | "POSSIBLE" | "WEAK" | "INELIGIBLE";

export type RoleFamily =
  | "SOFTWARE_ENGINEERING"
  | "BACKEND_ENGINEERING"
  | "FULLSTACK_ENGINEERING"
  | "FRONTEND_ENGINEERING"
  | "MOBILE_ENGINEERING"
  | "DEVOPS_INFRA"
  | "DATA_ENGINEERING"
  | "AI_ML_ENGINEERING"
  | "JOURNALISM"
  | "SALES"
  | "MARKETING"
  | "HR"
  | "RECRUITING"
  | "ACCOUNTING"
  | "GRAPHIC_DESIGN"
  | "CUSTOMER_SERVICE"
  | "OTHER_NON_TECH"
  | "UNKNOWN";

export type SeniorityLevel =
  | "INTERN"
  | "ENTRY"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "STAFF"
  | "PRINCIPAL"
  | "LEAD"
  | "MANAGEMENT"
  | "UNKNOWN";

export type CanonicalProfile = {
  roleTargets: string[];
  experienceLevel: string | null;
  skills: string[];
  evidenceSkills: string[];
  countryCode: string | null;
  countryNames: string[];
  workModes: string[];
  /** Explicit discovery search targets. Residence outside these countries is not a hard location failure. */
  searchTargetCountryCodes?: string[];
};

export type CanonicalJobInput = {
  title: string;
  description: string;
  location: string | null;
  countryCode?: string | null;
  workMode?: string | null;
};

export type CanonicalComponents = {
  roleAlignment: number;
  stackMatch: number;
  seniorityFit: number;
  evidenceStrength: number;
  locationFit: number;
  experienceAlignment: number;
  dataConfidence: number;
};

export type CanonicalMatchResult = {
  eligibility: MatchEligibility;
  blockingReasons: BlockingReason[];
  score: number | null;
  band: MatchBand;
  roleFamily: RoleFamily;
  seniority: SeniorityLevel;
  components: CanonicalComponents;
  explanation: string[];
  gaps: string[];
};

const SENIORITY_RANK: Record<SeniorityLevel, number> = {
  UNKNOWN: -1,
  INTERN: 0,
  ENTRY: 1,
  JUNIOR: 2,
  MID: 3,
  SENIOR: 4,
  STAFF: 5,
  PRINCIPAL: 6,
  LEAD: 7,
  MANAGEMENT: 8,
};

const BLOCKING_LABELS: Record<BlockingReason, string> = {
  ROLE_FAMILY_MISMATCH: "Role family does not match the target profile",
  SENIORITY_MISMATCH: "Seniority is above the target profile",
  CORE_STACK_MISMATCH: "A mandatory core technology is not evidenced",
  LOCATION_INELIGIBLE: "Location or remote policy excludes this profile",
  EXPERIENCE_MISMATCH: "Explicit commercial experience exceeds the profile",
  UNKNOWN_LOCATION_POLICY: "Location policy is ambiguous",
  UNKNOWN_SENIORITY: "Seniority is not stated",
  INSUFFICIENT_JOB_DATA: "The posting does not contain enough detail to trust a strong match",
};

type TechDef = {
  id: string;
  family: string;
  primary: boolean;
  pattern: RegExp;
};

const TECH: TechDef[] = [
  { id: "typescript", family: "js", primary: true, pattern: /\btypescript\b|\b\bts\b/i },
  { id: "javascript", family: "js", primary: true, pattern: /\bjavascript\b|\bnode\.?js\b|\bnodejs\b/i },
  { id: "react", family: "js", primary: false, pattern: /\breact(?!\s*native)\b|\breactjs\b/i },
  { id: "next", family: "js", primary: false, pattern: /\bnext\.?js\b|\bnextjs\b/i },
  { id: "postgresql", family: "data", primary: false, pattern: /\bpostgresql\b|\bpostgres\b/i },
  { id: "prisma", family: "data", primary: false, pattern: /\bprisma\b/i },
  { id: "csharp", family: "dotnet", primary: true, pattern: /\bc\s*#(?!\w)|\bc\s*sharp\b|\bcsharp\b/i },
  { id: "dotnet", family: "dotnet", primary: true, pattern: /\.net\b|\bdotnet\b|\basp\.net\b/i },
  { id: "java", family: "java", primary: true, pattern: /\bjava\b(?!script)/i },
  { id: "php", family: "php", primary: true, pattern: /\bphp\b|\blaravel\b/i },
  { id: "python", family: "python", primary: true, pattern: /\bpython\b/i },
  { id: "golang", family: "go", primary: true, pattern: /\bgolang\b|\bgo engineer\b|\bgo developer\b/i },
  { id: "ruby", family: "ruby", primary: true, pattern: /\bruby\b|\brails\b/i },
  { id: "swift", family: "mobile", primary: true, pattern: /\bswift\b|\bios\b/i },
  { id: "kotlin", family: "mobile", primary: true, pattern: /\bkotlin\b|\bandroid\b/i },
  { id: "docker", family: "ops", primary: false, pattern: /\bdocker\b/i },
  { id: "aws", family: "ops", primary: false, pattern: /\baws\b|\bamazon web services\b/i },
];

const NON_TECH_TITLE: Array<{ family: RoleFamily; pattern: RegExp }> = [
  { family: "JOURNALISM", pattern: /\b(journalist|journalism|reporter|tech journalist|news writer)\b/i },
  { family: "SALES", pattern: /\b(sales engineer|account executive|sales representative|sales manager|business development)\b/i },
  { family: "MARKETING", pattern: /\b(marketing manager|growth marketer|content marketer|marketing specialist)\b/i },
  { family: "RECRUITING", pattern: /\b(recruiter|recruiting|talent acquisition)\b/i },
  { family: "HR", pattern: /\b(human resources|hr manager|hr generalist|people partner)\b/i },
  { family: "ACCOUNTING", pattern: /\b(accountant|accounting|bookkeeper)\b/i },
  { family: "GRAPHIC_DESIGN", pattern: /\b(graphic designer|graphic design)\b/i },
  { family: "CUSTOMER_SERVICE", pattern: /\b(customer service|customer support)\b/i },
];

export function blockingReasonLabel(reason: BlockingReason): string {
  return BLOCKING_LABELS[reason];
}

export function evaluateCanonicalMatch(
  job: CanonicalJobInput,
  profile: CanonicalProfile,
): CanonicalMatchResult {
  const title = job.title.trim();
  const description = job.description.trim();
  const roleFamily = classifyRoleFamily(title, description);
  const seniority = inferSeniority(title, description);
  const yearsRequired = inferMinimumYears(description);
  const stack = extractStack(title, description);
  const userTech = skillIds([...profile.skills, ...profile.evidenceSkills]);
  const evidenceTech = skillIds(profile.evidenceSkills.length > 0 ? profile.evidenceSkills : profile.skills);
  const location = evaluateLocation(job, profile);
  const acceptable = acceptableFamilies(profile.roleTargets);
  const profileCeiling = profileSeniorityCeiling(profile.experienceLevel);
  const profileYears = yearsSupportedBySeniority(profileCeiling);

  const hard: BlockingReason[] = [];
  const review: BlockingReason[] = [];

  if (roleFamily === "UNKNOWN" || !acceptable.has(roleFamily)) {
    hard.push("ROLE_FAMILY_MISMATCH");
  }

  if (seniority !== "UNKNOWN" && SENIORITY_RANK[seniority] > SENIORITY_RANK[profileCeiling]) {
    hard.push("SENIORITY_MISMATCH");
  } else if (seniority === "UNKNOWN" && /\b(lead a team|people management|director)\b/i.test(description)) {
    review.push("UNKNOWN_SENIORITY");
  }

  if (yearsRequired != null && yearsRequired >= 5 && profileYears < yearsRequired) {
    hard.push("EXPERIENCE_MISMATCH");
  }

  const missingCoreFamilies = missingPrimaryFamilies(stack.core, userTech);
  if (missingCoreFamilies.length > 0) {
    hard.push("CORE_STACK_MISMATCH");
  }

  if (location.status === "INELIGIBLE") hard.push("LOCATION_INELIGIBLE");
  if (location.status === "REVIEW") review.push("UNKNOWN_LOCATION_POLICY");

  const thinPosting = description.length < 80 && stack.core.size + stack.optional.size < 2;
  if (thinPosting) review.push("INSUFFICIENT_JOB_DATA");

  const components = scoreComponents({
    roleFamily,
    acceptable,
    seniority,
    profileCeiling,
    stack,
    userTech,
    evidenceTech,
    locationStatus: location.status,
    yearsRequired,
    profileYears,
    descriptionLength: description.length,
    thinPosting,
  });

  const uniqueHard = unique(hard);
  const uniqueReview = unique(review).filter((reason) => !uniqueHard.includes(reason as BlockingReason));

  if (uniqueHard.length > 0) {
    return {
      eligibility: "INELIGIBLE",
      blockingReasons: uniqueHard,
      score: null,
      band: "INELIGIBLE",
      roleFamily,
      seniority,
      components,
      explanation: uniqueHard.map((reason) => blockingReasonLabel(reason)),
      gaps: missingCoreFamilies,
    };
  }

  const score = weightedScore(components);
  let band = bandForScore(score);
  const eligibility: MatchEligibility = uniqueReview.length > 0 ? "REVIEW_REQUIRED" : "ELIGIBLE";
  if (eligibility === "REVIEW_REQUIRED" && band === "STRONG") band = "POSSIBLE";

  const explanation = [
    `${roleFamily.replaceAll("_", " ")} compared with target roles`,
    `${stack.core.size} core technologies, ${missingCoreFamilies.length} missing primary families`,
    `Seniority ${seniority} against profile ceiling ${profileCeiling}`,
    location.explanation,
  ];
  if (uniqueReview.length > 0) {
    explanation.push(...uniqueReview.map((reason) => blockingReasonLabel(reason)));
  }

  return {
    eligibility,
    blockingReasons: uniqueReview,
    score,
    band,
    roleFamily,
    seniority,
    components,
    explanation,
    gaps: [...stack.optional].filter((id) => !userTech.has(id)),
  };
}

export function canAutoQueue(result: CanonicalMatchResult): boolean {
  return result.eligibility === "ELIGIBLE" && result.band !== "INELIGIBLE";
}

export function canManuallyQueue(result: CanonicalMatchResult): boolean {
  return result.eligibility !== "INELIGIBLE";
}

export function previewJobSignals(job: CanonicalJobInput): {
  roleFamily: RoleFamily;
  seniority: SeniorityLevel;
  coreTechIds: string[];
} {
  const stack = extractStack(job.title, job.description);
  return {
    roleFamily: classifyRoleFamily(job.title, job.description),
    seniority: inferSeniority(job.title, job.description),
    coreTechIds: [...stack.core],
  };
}

export function normalizeTechIds(skills: string[]): string[] {
  return [...skillIds(skills)];
}

function classifyRoleFamily(title: string, description: string): RoleFamily {
  for (const rule of NON_TECH_TITLE) {
    if (rule.pattern.test(title)) return rule.family;
  }
  const titleFamily = engineeringFamily(title);
  if (titleFamily) return titleFamily;
  const descFamily = engineeringFamily(description.slice(0, 600));
  if (descFamily) return descFamily;
  const stack = extractStack(title, description);
  const hasPrimary = [...stack.core].some((id) => TECH.find((tech) => tech.id === id)?.primary);
  return hasPrimary ? "SOFTWARE_ENGINEERING" : "UNKNOWN";
}

function engineeringFamily(text: string): RoleFamily | null {
  if (/\bfull[\s-]?stack\b/i.test(text)) return "FULLSTACK_ENGINEERING";
  if (/\bback[\s-]?end\b/i.test(text)) return "BACKEND_ENGINEERING";
  if (/\bfront[\s-]?end\b/i.test(text)) return "FRONTEND_ENGINEERING";
  if (/\b(react native|ios|android|mobile developer|mobile engineer)\b/i.test(text)) return "MOBILE_ENGINEERING";
  if (/\b(devops|site reliability|sre|infrastructure engineer|platform engineer)\b/i.test(text)) return "DEVOPS_INFRA";
  if (/\b(data engineer|data scientist)\b/i.test(text)) return "DATA_ENGINEERING";
  if (/\b(machine learning|ml engineer|ai engineer)\b/i.test(text)) return "AI_ML_ENGINEERING";
  if (/\b(software engineer|software developer|web developer|programmer|developer|engineer)\b/i.test(text)) {
    return "SOFTWARE_ENGINEERING";
  }
  return null;
}

function acceptableFamilies(roleTargets: string[]): Set<RoleFamily> {
  const text = roleTargets.join(" ").toLowerCase();
  const families = new Set<RoleFamily>();
  const mentionsSoftware = /software|engineer|developer|backend|back-end|full[\s-]?stack|frontend|front-end|web/.test(text);
  if (mentionsSoftware || roleTargets.length === 0) {
    families.add("SOFTWARE_ENGINEERING");
    families.add("BACKEND_ENGINEERING");
    families.add("FULLSTACK_ENGINEERING");
    families.add("FRONTEND_ENGINEERING");
  }
  if (/mobile|ios|android/.test(text)) families.add("MOBILE_ENGINEERING");
  if (/devops|sre|infrastructure/.test(text)) families.add("DEVOPS_INFRA");
  if (/data engineer|data scientist/.test(text)) families.add("DATA_ENGINEERING");
  if (/machine learning|\bml\b|ai engineer/.test(text)) families.add("AI_ML_ENGINEERING");
  return families;
}

function inferSeniority(title: string, description: string): SeniorityLevel {
  const fromTitle = seniorityFromText(title);
  const fromDescription = seniorityFromText(description.slice(0, 1500));
  const fromYears = yearsToSeniority(inferMinimumYears(description));
  return maxSeniority([fromTitle, fromDescription, fromYears]);
}

function seniorityFromText(text: string): SeniorityLevel {
  const value = text.toLowerCase();
  if (/\b(manager|director|head of|vp|vice president)\b/.test(value)) return "MANAGEMENT";
  if (/\bprincipal\b/.test(value)) return "PRINCIPAL";
  if (/\bstaff\b/.test(value)) return "STAFF";
  if (/\blead\b/.test(value)) return "LEAD";
  if (/\b(senior|sr\.|sr\b)\b/.test(value)) return "SENIOR";
  if (/\b(mid[\s-]?level|intermediate)\b/.test(value)) return "MID";
  if (/\b(junior|jr\.|jr\b|associate)\b/.test(value)) return "JUNIOR";
  if (/\b(entry[\s-]?level|graduate|new grad)\b/.test(value)) return "ENTRY";
  if (/\bintern(ship)?\b/.test(value)) return "INTERN";
  return "UNKNOWN";
}

function inferMinimumYears(description: string): number | null {
  const matches = [...description.matchAll(/(\d+)\s*(?:\+|plus)?\s*(?:-\s*\d+\s*)?years?/gi)];
  if (matches.length === 0) return null;
  return Math.max(...matches.map((match) => Number(match[1])));
}

function yearsToSeniority(years: number | null): SeniorityLevel {
  if (years == null) return "UNKNOWN";
  if (years >= 8) return "STAFF";
  if (years >= 5) return "SENIOR";
  if (years >= 3) return "MID";
  if (years >= 1) return "JUNIOR";
  return "ENTRY";
}

function maxSeniority(levels: SeniorityLevel[]): SeniorityLevel {
  return levels.reduce((best, level) =>
    SENIORITY_RANK[level] > SENIORITY_RANK[best] ? level : best,
  "UNKNOWN");
}

function profileSeniorityCeiling(experienceLevel: string | null): SeniorityLevel {
  const parsed = seniorityFromText(experienceLevel ?? "");
  if (parsed === "UNKNOWN") return "JUNIOR";
  if (parsed === "MID") return "MID";
  if (SENIORITY_RANK[parsed] >= SENIORITY_RANK.SENIOR) return parsed;
  return parsed;
}

function yearsSupportedBySeniority(level: SeniorityLevel): number {
  if (SENIORITY_RANK[level] >= SENIORITY_RANK.SENIOR) return 8;
  if (level === "MID") return 3;
  if (level === "JUNIOR" || level === "ENTRY") return 1;
  return 0;
}

function extractStack(title: string, description: string): { core: Set<string>; optional: Set<string> } {
  const core = new Set<string>();
  const optional = new Set<string>();
  for (const tech of TECH) {
    if (tech.pattern.test(title)) core.add(tech.id);
  }
  const protectedDescription = description.replace(/(\w)\.(?=\w)/g, "$1\u0000");
  for (const rawSentence of protectedDescription.split(/[.\n]/)) {
    const sentence = rawSentence.replace(/\u0000/g, ".");
    const optionalSentence = /\b(nice to have|preferred|bonus|familiarity|exposure to|plus if)\b/i.test(sentence);
    const coreSentence = /\b(required|must have|must-have|mandatory|proficiency|strong experience|minimum \d+ years)\b/i.test(sentence);
    for (const tech of TECH) {
      if (!tech.pattern.test(sentence)) continue;
      if (optionalSentence && !coreSentence) optional.add(tech.id);
      else if (coreSentence || tech.primary) core.add(tech.id);
    }
  }
  for (const id of core) optional.delete(id);
  return { core, optional };
}

function skillIds(skills: string[]): Set<string> {
  const blob = skills.join("\n");
  const ids = new Set<string>();
  for (const tech of TECH) {
    if (tech.pattern.test(blob) || skills.some((skill) => normalizeSkill(skill) === tech.id)) {
      ids.add(tech.id);
    }
  }
  if (skills.some((skill) => /\bgo\b/i.test(skill))) ids.add("golang");
  if (skills.some((skill) => /node/i.test(skill))) ids.add("javascript");
  return ids;
}

function missingPrimaryFamilies(core: Set<string>, userTech: Set<string>): string[] {
  const userFamilies = new Set(
    TECH.filter((tech) => userTech.has(tech.id)).map((tech) => tech.family),
  );
  const missing = new Set<string>();
  for (const id of core) {
    const tech = TECH.find((item) => item.id === id);
    if (!tech?.primary) continue;
    if (!userFamilies.has(tech.family)) missing.add(tech.family);
  }
  return [...missing];
}

function evaluateLocation(
  job: CanonicalJobInput,
  profile: CanonicalProfile,
): { status: "ELIGIBLE" | "INELIGIBLE" | "REVIEW"; explanation: string } {
  const text = `${job.location ?? ""}\n${job.description}`;
  const country = (profile.countryCode ?? "").toUpperCase();
  const names = profile.countryNames.map((name) => name.toLowerCase());
  const userInTurkey = country === "TR" || names.some((name) => /turkey|türkiye|turkiye/.test(name));
  const turkeyMentioned = /\b(türkiye|turkiye|turkey|istanbul)\b/i.test(text) || (job.countryCode ?? "").toUpperCase() === "TR";
  const worldwide = /\b(worldwide|work from anywhere|remote worldwide|anywhere in the world|global remote)\b/i.test(text);
  const restricted = restrictedRegion(text);
  const searchTargets = new Set((profile.searchTargetCountryCodes ?? []).map((code) => code.toUpperCase()));

  if (restricted && searchTargets.has(restricted)) {
    return {
      status: "REVIEW",
      explanation: "Remote restriction matches an explicit search target, and work eligibility is not confirmed",
    };
  }

  if (restricted && userInTurkey && !turkeyMentioned && restricted !== "TR") {
    return { status: "INELIGIBLE", explanation: `Remote policy is limited to ${restricted}` };
  }
  if (worldwide || (turkeyMentioned && (userInTurkey || !country))) {
    return { status: "ELIGIBLE", explanation: "Location is compatible with the stored profile" };
  }
  if (/\b(europe|emea|eu)\b/i.test(text) && /\bremote\b/i.test(text)) {
    return { status: "REVIEW", explanation: "Europe or EMEA remote policy does not say whether Türkiye is accepted" };
  }
  if (/\bremote\b/i.test(text)) {
    return { status: "REVIEW", explanation: "Remote is stated without a country policy" };
  }
  if (!job.location && job.workMode !== "ONSITE") {
    return { status: "REVIEW", explanation: "Location policy is not stated" };
  }
  return { status: "REVIEW", explanation: "Location could not be confirmed against the profile" };
}

function restrictedRegion(text: string): string | null {
  if (/\b(us-only|u\.s\. only|usa only|united states only|remote\s*\(?\s*us\b|must be (?:located |based )?(?:in|within) the (?:us|u\.s\.|united states))\b/i.test(text)) {
    return "US";
  }
  if (/\b(canada-only|canada only|must be (?:based|located) in canada)\b/i.test(text)) return "CA";
  if (/\b(uk-only|uk only|united kingdom only|must be based in the uk)\b/i.test(text)) return "UK";
  if (/\b(germany only|must be based in germany)\b/i.test(text)) return "DE";
  return null;
}

function scoreComponents(input: {
  roleFamily: RoleFamily;
  acceptable: Set<RoleFamily>;
  seniority: SeniorityLevel;
  profileCeiling: SeniorityLevel;
  stack: { core: Set<string>; optional: Set<string> };
  userTech: Set<string>;
  evidenceTech: Set<string>;
  locationStatus: "ELIGIBLE" | "INELIGIBLE" | "REVIEW";
  yearsRequired: number | null;
  profileYears: number;
  descriptionLength: number;
  thinPosting: boolean;
}): CanonicalComponents {
  const roleAlignment = !input.acceptable.has(input.roleFamily)
    ? 0
    : input.roleFamily === "BACKEND_ENGINEERING" || input.roleFamily === "SOFTWARE_ENGINEERING"
      ? 100
      : input.roleFamily === "FULLSTACK_ENGINEERING"
        ? 88
        : input.roleFamily === "FRONTEND_ENGINEERING"
          ? 70
          : 40;

  const coreCount = input.stack.core.size;
  const matchedCore = [...input.stack.core].filter((id) => {
    const tech = TECH.find((item) => item.id === id);
    return tech ? [...input.userTech].some((userId) => TECH.find((item) => item.id === userId)?.family === tech.family) : false;
  }).length;
  const stackMatch = coreCount === 0 ? 45 : Math.round((matchedCore / coreCount) * 100);

  const seniorityFit = input.seniority === "UNKNOWN"
    ? 40
    : SENIORITY_RANK[input.seniority] <= SENIORITY_RANK[input.profileCeiling]
      ? 100
      : 0;

  const evidenced = [...input.stack.core].filter((id) => input.evidenceTech.has(id)).length;
  const evidenceStrength = coreCount === 0 ? 40 : Math.round((evidenced / coreCount) * 100);

  const locationFit = input.locationStatus === "ELIGIBLE" ? 100 : input.locationStatus === "REVIEW" ? 40 : 0;
  const experienceAlignment = input.yearsRequired == null
    ? 70
    : input.profileYears >= input.yearsRequired
      ? 100
      : 20;

  let dataConfidence = 30;
  if (input.descriptionLength >= 80) dataConfidence += 25;
  if (input.seniority !== "UNKNOWN") dataConfidence += 15;
  if (input.locationStatus === "ELIGIBLE") dataConfidence += 15;
  if (coreCount > 0) dataConfidence += 15;
  if (input.thinPosting) dataConfidence = Math.min(dataConfidence, 35);

  return {
    roleAlignment,
    stackMatch,
    seniorityFit,
    evidenceStrength,
    locationFit,
    experienceAlignment,
    dataConfidence: Math.min(100, dataConfidence),
  };
}

function weightedScore(components: CanonicalComponents): number {
  const total =
    components.roleAlignment * 0.25 +
    components.stackMatch * 0.25 +
    components.seniorityFit * 0.15 +
    components.evidenceStrength * 0.15 +
    components.locationFit * 0.1 +
    components.experienceAlignment * 0.05 +
    components.dataConfidence * 0.05;
  return Math.max(0, Math.min(100, Math.round(total)));
}

function bandForScore(score: number): MatchBand {
  if (score >= 75) return "STRONG";
  if (score >= 55) return "POSSIBLE";
  return "WEAK";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9#+.]+/g, "");
}
