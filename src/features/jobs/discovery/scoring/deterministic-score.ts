import { SCORE_WEIGHTS, SCORE_BAND_THRESHOLDS } from "../constants";
import type { JobDiscoveryRoleTarget, JobDiscoveryLocationTarget, DiscoveryScoreBreakdown } from "../types";
import { normalizeTitle } from "../normalization/normalize-text";

// Skill aliases for conservative matching
const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js"],
  typescript: ["ts"],
  "react.js": ["react", "reactjs"],
  "node.js": ["node", "nodejs"],
  "vue.js": ["vue", "vuejs"],
  "next.js": ["next", "nextjs"],
  postgresql: ["postgres", "psql"],
  mongodb: ["mongo"],
  kubernetes: ["k8s"],
  "amazon web services": ["aws"],
  "google cloud platform": ["gcp"],
  "microsoft azure": ["azure"],
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim();
}

function skillMatches(jobSkill: string, userSkill: string): boolean {
  const normJob = normalizeSkill(jobSkill);
  const normUser = normalizeSkill(userSkill);
  if (normJob === normUser) return true;
  // Check aliases
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const all = [canonical, ...aliases];
    if (all.includes(normJob) && all.includes(normUser)) return true;
  }
  return false;
}

export interface DeterministicScoreInput {
  jobTitle: string;
  jobDescription: string;
  jobLocation: string | null;
  jobCountryCode: string | null;
  jobWorkMode: string;
  jobEmploymentType: string;
  jobPostedAt: string | null;
  roleTargets: JobDiscoveryRoleTarget[];
  locationTargets: JobDiscoveryLocationTarget[];
  userWorkModes: string[];
  userEmploymentTypes: string[];
  userExperienceLevel: string | null;
  userSkills: string[];
  userEvidenceSkills: string[];
  freshnessDays: number;
}

export interface DeterministicScoreResult {
  breakdown: DiscoveryScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  softBlockers: string[];
  evidence: string[];
  scoreBand: string;
}

function scoreRoleAlignment(input: DeterministicScoreInput): { score: number; evidence: string[] } {
  const normJobTitle = normalizeTitle(input.jobTitle);
  const descLower = input.jobDescription.toLowerCase();
  let best = 0;
  const evidence: string[] = [];

  for (const target of input.roleTargets) {
    if (!target.enabled) continue;
    const normTarget = normalizeTitle(target.title);
    const allTitles = [normTarget, ...target.aliases.map(normalizeTitle)];

    for (const t of allTitles) {
      if (normJobTitle.includes(t) || t.includes(normJobTitle)) {
        const score = target.priority === "high" ? 25 : target.priority === "medium" ? 20 : 15;
        if (score > best) {
          best = score;
          evidence.push(`Title matches "${target.title}"`);
        }
        break;
      }
      if (descLower.includes(t) && best < 10) {
        best = 10;
        evidence.push(`Description mentions "${target.title}"`);
      }
    }
  }

  return { score: best, evidence };
}

function scoreSkillsOverlap(input: DeterministicScoreInput): { score: number; matched: string[]; missing: string[] } {
  const descLower = input.jobDescription.toLowerCase();
  const titleLower = input.jobTitle.toLowerCase();
  const text = `${titleLower} ${descLower}`;

  // Extract mentioned skills from job text
  const allUserSkills = [...new Set([...input.userSkills, ...input.userEvidenceSkills])];
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of allUserSkills) {
    const normSkill = normalizeSkill(skill);
    const aliases = SKILL_ALIASES[normSkill] ?? [];
    const allForms = [normSkill, ...aliases];
    if (allForms.some(s => text.includes(s))) {
      matched.push(skill);
    }
  }

  // Find skills mentioned in job that user doesn't have (heuristic)
  const commonTechKeywords = [
    "python", "java", "go", "rust", "c++", "ruby", "php", "swift", "kotlin",
    "react", "angular", "vue", "django", "flask", "spring", "docker", "kubernetes",
    "aws", "gcp", "azure", "terraform", "graphql", "rest", "sql", "nosql",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  ];

  for (const kw of commonTechKeywords) {
    if (text.includes(kw) && !allUserSkills.some(s => skillMatches(kw, s))) {
      if (!matched.includes(kw)) missing.push(kw);
    }
  }

  const ratio = allUserSkills.length > 0 ? matched.length / Math.max(matched.length + missing.length, 1) : 0;
  const score = Math.round(ratio * SCORE_WEIGHTS.skillsOverlap);

  return { score, matched: matched.slice(0, 20), missing: missing.slice(0, 20) };
}

function scoreSeniority(input: DeterministicScoreInput): { score: number; softBlockers: string[] } {
  if (!input.userExperienceLevel) return { score: Math.round(SCORE_WEIGHTS.experienceSeniority * 0.5), softBlockers: [] };

  const titleLower = input.jobTitle.toLowerCase();
  const descLower = input.jobDescription.toLowerCase().slice(0, 2000);
  const softBlockers: string[] = [];

  const seniorityKeywords: Record<string, number> = {
    intern: 0, junior: 1, entry: 1, "associate": 1,
    mid: 2, "mid-level": 2, "intermediate": 2,
    senior: 3, "sr.": 3, "sr ": 3,
    lead: 4, principal: 5, staff: 5, director: 6, vp: 7, "head of": 6,
  };

  const userLevelMap: Record<string, number> = {
    entry: 1, junior: 1, "mid-level": 2, mid: 2, senior: 3, lead: 4, principal: 5, staff: 5,
  };

  let jobLevel = 2; // default mid
  for (const [kw, level] of Object.entries(seniorityKeywords)) {
    if (titleLower.includes(kw)) { jobLevel = level; break; }
  }

  const userLevel = userLevelMap[input.userExperienceLevel.toLowerCase()] ?? 2;
  const gap = Math.abs(jobLevel - userLevel);

  if (gap === 0) return { score: SCORE_WEIGHTS.experienceSeniority, softBlockers };
  if (gap === 1) return { score: Math.round(SCORE_WEIGHTS.experienceSeniority * 0.7), softBlockers };
  if (gap === 2) {
    softBlockers.push(`Seniority gap: job appears ${jobLevel > userLevel ? "more senior" : "less senior"} than profile`);
    return { score: Math.round(SCORE_WEIGHTS.experienceSeniority * 0.3), softBlockers };
  }

  softBlockers.push(`Significant seniority mismatch`);
  return { score: 0, softBlockers };
}

function scoreEvidence(input: DeterministicScoreInput, matchedSkills: string[]): number {
  const evidenceCount = input.userEvidenceSkills.filter(s =>
    matchedSkills.some(ms => skillMatches(s, ms))
  ).length;
  const ratio = matchedSkills.length > 0 ? evidenceCount / matchedSkills.length : 0;
  return Math.round(ratio * SCORE_WEIGHTS.evidenceStrength);
}

function scoreLocation(input: DeterministicScoreInput): { score: number; softBlockers: string[] } {
  const softBlockers: string[] = [];

  if (input.jobWorkMode === "REMOTE") {
    if (input.userWorkModes.length === 0 || input.userWorkModes.includes("REMOTE")) {
      return { score: SCORE_WEIGHTS.locationWorkMode, softBlockers };
    }
  }

  if (input.locationTargets.length === 0) {
    return { score: Math.round(SCORE_WEIGHTS.locationWorkMode * 0.5), softBlockers };
  }

  const jobCountry = (input.jobCountryCode ?? "").toUpperCase();
  const match = input.locationTargets.find(t => t.enabled && t.countryCode.toUpperCase() === jobCountry);

  if (match) return { score: SCORE_WEIGHTS.locationWorkMode, softBlockers };

  if (jobCountry) {
    softBlockers.push("Location not in target countries");
    return { score: Math.round(SCORE_WEIGHTS.locationWorkMode * 0.2), softBlockers };
  }

  return { score: Math.round(SCORE_WEIGHTS.locationWorkMode * 0.5), softBlockers };
}

function scoreFreshness(input: DeterministicScoreInput): number {
  if (!input.jobPostedAt) return Math.round(SCORE_WEIGHTS.freshness * 0.5);

  const posted = new Date(input.jobPostedAt);
  if (isNaN(posted.getTime())) return Math.round(SCORE_WEIGHTS.freshness * 0.5);

  const daysSincePost = Math.max(0, (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSincePost <= 3) return SCORE_WEIGHTS.freshness;
  if (daysSincePost <= 7) return Math.round(SCORE_WEIGHTS.freshness * 0.8);
  if (daysSincePost <= input.freshnessDays) return Math.round(SCORE_WEIGHTS.freshness * 0.5);
  return Math.round(SCORE_WEIGHTS.freshness * 0.2);
}

function scoreEmploymentType(input: DeterministicScoreInput): number {
  if (input.userEmploymentTypes.length === 0) return SCORE_WEIGHTS.employmentType;
  if (input.jobEmploymentType === "UNKNOWN") return Math.round(SCORE_WEIGHTS.employmentType * 0.5);
  if (input.userEmploymentTypes.includes(input.jobEmploymentType)) return SCORE_WEIGHTS.employmentType;
  return 0;
}

function getScoreBand(score: number): string {
  if (score >= SCORE_BAND_THRESHOLDS.EXCELLENT) return "EXCELLENT";
  if (score >= SCORE_BAND_THRESHOLDS.STRONG) return "STRONG";
  if (score >= SCORE_BAND_THRESHOLDS.POSSIBLE) return "POSSIBLE";
  return "LOW";
}

export function calculateDeterministicScore(input: DeterministicScoreInput): DeterministicScoreResult {
  const role = scoreRoleAlignment(input);
  const skills = scoreSkillsOverlap(input);
  const seniority = scoreSeniority(input);
  const evidence = scoreEvidence(input, skills.matched);
  const location = scoreLocation(input);
  const freshness = scoreFreshness(input);
  const employment = scoreEmploymentType(input);

  const total = role.score + skills.score + seniority.score + evidence + location.score + freshness + employment;

  return {
    breakdown: {
      roleAlignment: role.score,
      skillsOverlap: skills.score,
      experienceSeniority: seniority.score,
      evidenceStrength: evidence,
      locationWorkMode: location.score,
      freshness,
      employmentType: employment,
      total,
    },
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
    hardBlockers: [],
    softBlockers: [...seniority.softBlockers, ...location.softBlockers],
    evidence: role.evidence,
    scoreBand: getScoreBand(total),
  };
}
