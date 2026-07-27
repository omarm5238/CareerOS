export type InsightItemType =
  | "resume_fix"
  | "skill_gap"
  | "skill_learning"
  | "project_proof"
  | "job_follow_up"
  | "application_action"
  | "warning"
  | "calendar_task";

export type ClassifiedInsightItem = {
  text: string;
  type: InsightItemType;
};

const RESUME_FIX_VERBS =
  /^(add|include|clarify|improve|provide|highlight|consider|prepare|review|rewrite|restructure|create|update|expand|move|remove|fix|ensure|make sure|write|organize|format)\b/i;

const RESUME_IMPROVEMENT_PHRASES =
  /\b(skills section|dedicated skills|measurable achievements|quantified achievements|quantify impact|work experience|internships?|certifications?|education section|section headers?|consistent bullet|personal pronouns|add dates|clarify timeline|resume overall|portfolio link|github link|ats|formatting|profile summary|experience section|resume fix|bullet points)\b/i;

const GENERIC_CAREER_ADVICE =
  /\b(soft skills?|teamwork|collaboration|communication|leadership|networking|keep learning|improve your career|unlock your potential)\b/i;

const NON_MARKET_SKILL_LABELS = new Set([
  "teamwork",
  "soft skills",
  "soft skill",
  "certifications",
  "certification",
  "quantified achievements",
  "measurable achievements",
  "communication",
  "leadership",
  "collaboration",
]);

const JOB_ACTION_PATTERNS =
  /\b(apply|application|follow[- ]?up|saved job|target job|save (one|a|1)|add (saved )?jobs?|benchmark|job descriptions?|interview|recruiter|cover letter)\b/i;

const PROJECT_PATTERNS =
  /\b(project|portfolio|github|demo|proof|build a|deploy|dockerize|containerize)\b/i;

const LEARNING_PATTERNS =
  /\b(learn|study|practice|course|tutorial|hours?|roadmap)\b/i;

const WARNING_PATTERNS =
  /\b(warning|outdated|missing|unavailable|do not|cannot|stale|fallback)\b/i;

const KNOWN_MULTIWORD_SKILLS = [
  "object-oriented programming",
  "object oriented programming",
  "role-based access control",
  "role based access control",
  "machine learning",
  "natural language processing",
  "continuous integration",
  "continuous delivery",
  "test driven development",
  "rest api",
  "rest apis",
  "spring boot",
  "java spring boot",
  "node.js",
  "next.js",
  "react native",
  "unit testing",
  "system design",
  "data structures",
  "version control",
  "ci/cd",
  "graphql",
];

const MAX_SKILL_WORDS = 5;
const MAX_SKILL_CHARS = 48;

export function normalizeInsightLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isResumeImprovementPhrase(value: string): boolean {
  const trimmed = normalizeInsightLabel(value);
  if (!trimmed) return false;
  if (RESUME_FIX_VERBS.test(trimmed)) return true;
  if (RESUME_IMPROVEMENT_PHRASES.test(trimmed)) return true;
  return false;
}

export function isGenericCareerAdvice(value: string): boolean {
  const trimmed = normalizeInsightLabel(value);
  if (!trimmed) return false;
  if (NON_MARKET_SKILL_LABELS.has(trimmed.toLowerCase())) return true;
  if (GENERIC_CAREER_ADVICE.test(trimmed) && !isValidMarketSkillName(trimmed)) {
    return true;
  }
  return false;
}

export function isValidSkillName(value: string): boolean {
  return isValidMarketSkillName(value);
}

export function isValidMarketSkillName(value: string): boolean {
  const trimmed = normalizeInsightLabel(value);
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (NON_MARKET_SKILL_LABELS.has(lower)) return false;
  if (isResumeImprovementPhrase(trimmed)) return false;
  if (KNOWN_MULTIWORD_SKILLS.includes(lower)) return true;

  if (trimmed.length > MAX_SKILL_CHARS) return false;
  if (RESUME_FIX_VERBS.test(trimmed)) return false;
  if (/[.!?]/.test(trimmed)) return false;
  if (/,|;|:/.test(trimmed) && trimmed.split(/[,;:]/).length > 2) return false;

  const words = trimmed.split(" ");
  if (words.length > MAX_SKILL_WORDS) return false;

  if (
    words.length >= 4 &&
    /\b(with|for|and|the|your|section|resume|clarity|achievements?)\b/i.test(trimmed)
  ) {
    return false;
  }

  if (/\b(bullet points|skills section|profile summary|experience section)\b/i.test(trimmed)) {
    return false;
  }

  return true;
}

export function normalizeSkillName(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = normalizeInsightLabel(value);
  if (!trimmed) return null;
  if (!isValidMarketSkillName(trimmed)) return null;
  return trimmed;
}

export function classifyInsightItem(text: string): InsightItemType {
  const trimmed = normalizeInsightLabel(text);
  if (!trimmed) return "warning";

  if (WARNING_PATTERNS.test(trimmed) && !isValidMarketSkillName(trimmed)) {
    return "warning";
  }

  if (isResumeImprovementPhrase(trimmed) || /\b(resume|ats|bullet|formatting|summary section)\b/i.test(trimmed)) {
    if (!isValidMarketSkillName(trimmed)) return "resume_fix";
  }

  if (JOB_ACTION_PATTERNS.test(trimmed)) {
    return /\b(apply|application)\b/i.test(trimmed)
      ? "application_action"
      : "job_follow_up";
  }

  if (PROJECT_PATTERNS.test(trimmed) && !isValidMarketSkillName(trimmed)) {
    return "project_proof";
  }

  if (LEARNING_PATTERNS.test(trimmed) && !isValidMarketSkillName(trimmed)) {
    return "skill_learning";
  }

  if (isValidMarketSkillName(trimmed)) {
    return "skill_gap";
  }

  if (RESUME_FIX_VERBS.test(trimmed)) return "resume_fix";

  return "warning";
}

export function filterSkillLikeItems(items: string[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeSkillName(item);
    if (!normalized) continue;
    if (result.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      continue;
    }
    result.push(normalized);
  }
  return result;
}

export function filterMarketSkillsOnly<T extends { skill?: string; name?: string; title?: string }>(
  items: T[],
): T[] {
  return items.filter((item) => {
    const label = item.skill ?? item.name ?? item.title ?? "";
    return isValidMarketSkillName(label);
  });
}

export function filterResumeAdviceOutOfSkills<T extends { skill?: string; name?: string; title?: string }>(
  items: T[],
): T[] {
  return items.filter((item) => {
    const label = item.skill ?? item.name ?? item.title ?? "";
    return !isResumeImprovementPhrase(label) && !isGenericCareerAdvice(label);
  });
}

export function filterResumeFixItems(items: string[]): string[] {
  return items.filter((item) => classifyInsightItem(item) === "resume_fix");
}

export function filterActionItems(items: string[]): ClassifiedInsightItem[] {
  return items
    .map((text) => ({ text: normalizeInsightLabel(text), type: classifyInsightItem(text) }))
    .filter((item) => item.text.length > 0);
}

export function stripResumeAdviceFromSkills<T extends { skill: string }>(items: T[]): T[] {
  return filterMarketSkillsOnly(filterResumeAdviceOutOfSkills(items));
}
