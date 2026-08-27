import { RESUME_TAILORING_LIMITS } from "../ai/parse-resume-tailoring-output";
import type {
  ResumeVersionContent,
  ResumeVersionExperienceBullet,
  ResumeVersionSkillCategory,
} from "../types";

export type ResumeVersionContentValidation =
  | { valid: true; data: ResumeVersionContent }
  | { valid: false; message: string; field?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trimEnd() : normalized;
}

function cleanTextArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];

  for (const item of value) {
    const text = cleanText(item, maxLength).replace(/\n+/g, " ").trim();
    if (!text) continue;
    result.push(text);
    if (result.length >= maxItems) break;
  }

  return result;
}

function cleanCategories(value: unknown): ResumeVersionSkillCategory[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionSkillCategory[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const category = cleanText(item.category, 60);
    const skills = cleanTextArray(item.skills, RESUME_TAILORING_LIMITS.skillsPerCategory, 60);
    if (!category || skills.length === 0) continue;
    result.push({ category, skills });
    if (result.length >= RESUME_TAILORING_LIMITS.technicalCategories) break;
  }

  return result;
}

function cleanBullets(
  value: unknown,
  maxItems: number,
  previous: ResumeVersionExperienceBullet[],
): ResumeVersionExperienceBullet[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionExperienceBullet[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) continue;
    const tailored = cleanText(item.tailored, RESUME_TAILORING_LIMITS.longText);
    if (!tailored) continue;

    const prior = previous[index];
    const original = cleanText(item.original, RESUME_TAILORING_LIMITS.longText);
    const rationale = cleanText(item.rationale, RESUME_TAILORING_LIMITS.shortText);

    result.push({
      source: cleanText(item.source, RESUME_TAILORING_LIMITS.shortText) || prior?.source || "Resume",
      ...(original ? { original } : prior?.original ? { original: prior.original } : {}),
      tailored,
      ...(rationale ? { rationale } : {}),
      // Evidence strength is an AI/analysis judgement, not a user-editable field.
      evidenceStrength: prior?.evidenceStrength ?? "medium",
    });

    if (result.length >= maxItems) break;
  }

  return result;
}

/**
 * Validates user-submitted resume version content.
 * Evidence strength is carried over from the previous revision so a manual edit
 * cannot upgrade an unsupported claim into strong evidence.
 */
export function validateResumeVersionContent(
  body: unknown,
  previous: ResumeVersionContent,
): ResumeVersionContentValidation {
  if (!isRecord(body)) {
    return { valid: false, message: "Invalid request body." };
  }

  const rawContent = isRecord(body.content) ? body.content : body;

  const summary = cleanText(rawContent.summary, RESUME_TAILORING_LIMITS.summary);
  if (!summary) {
    return {
      valid: false,
      message: "Professional summary cannot be empty.",
      field: "summary",
    };
  }

  const data: ResumeVersionContent = {
    summary,
    coreSkills: cleanTextArray(rawContent.coreSkills, RESUME_TAILORING_LIMITS.coreSkills, 60),
    technicalSkills: cleanCategories(rawContent.technicalSkills),
    experienceBullets: cleanBullets(
      rawContent.experienceBullets,
      RESUME_TAILORING_LIMITS.experienceBullets,
      previous.experienceBullets,
    ),
    projects: cleanBullets(
      rawContent.projects,
      RESUME_TAILORING_LIMITS.projects,
      previous.projects,
    ),
    education: cleanTextArray(rawContent.education, RESUME_TAILORING_LIMITS.education, 200),
    certifications: cleanTextArray(
      rawContent.certifications,
      RESUME_TAILORING_LIMITS.certifications,
      200,
    ),
  };

  return { valid: true, data };
}

/** Describes which sections a manual edit touched, for the change log. */
export function diffResumeVersionContent(
  previous: ResumeVersionContent,
  next: ResumeVersionContent,
): string[] {
  const changed: string[] = [];
  const compare = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(label);
  };

  compare("Professional Summary", previous.summary, next.summary);
  compare("Core Skills", previous.coreSkills, next.coreSkills);
  compare("Technical Skills", previous.technicalSkills, next.technicalSkills);
  compare("Experience Bullets", previous.experienceBullets, next.experienceBullets);
  compare("Projects", previous.projects, next.projects);
  compare("Education", previous.education, next.education);
  compare("Certifications", previous.certifications, next.certifications);

  return changed;
}
