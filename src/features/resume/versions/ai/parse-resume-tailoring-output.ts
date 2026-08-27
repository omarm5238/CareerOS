import type {
  ResumeVersionChangeLogItem,
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionEvidenceStrength,
  ResumeVersionExperienceBullet,
  ResumeVersionKeywordAction,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionKeywordImportance,
  ResumeVersionKeywordType,
  ResumeVersionSkillCategory,
  ResumeVersionWarning,
  ResumeVersionWarningSeverity,
  ResumeVersionWarningType,
} from "../types";
import type { ResumeTailoringAIPayload } from "./types";

export const RESUME_TAILORING_LIMITS = {
  tailoredTitle: 120,
  summary: 1_200,
  coreSkills: 12,
  technicalCategories: 8,
  skillsPerCategory: 12,
  experienceBullets: 8,
  projects: 6,
  education: 6,
  certifications: 6,
  keywordCoverage: 30,
  warnings: 12,
  changeLog: 12,
  evidenceNotes: 20,
  shortText: 240,
  longText: 600,
  /** Reordering words cannot create missing experience. */
  maxAlignmentGain: 25,
} as const;

const EVIDENCE_STRENGTHS: readonly ResumeVersionEvidenceStrength[] = [
  "strong",
  "medium",
  "weak",
  "none",
];

const KEYWORD_TYPES: readonly ResumeVersionKeywordType[] = [
  "technical_skill",
  "tool",
  "framework",
  "domain",
  "experience",
  "soft_skill",
  "certification",
  "education",
  "other",
];

const KEYWORD_IMPORTANCES: readonly ResumeVersionKeywordImportance[] = [
  "high",
  "medium",
  "low",
];

const KEYWORD_ACTIONS: readonly ResumeVersionKeywordAction[] = [
  "use_safely",
  "rephrase_existing_evidence",
  "move_higher",
  "add_to_project_evidence",
  "keep_out_of_resume",
  "add_to_roadmap",
];

const WARNING_TYPES: readonly ResumeVersionWarningType[] = [
  "missing_evidence",
  "seniority_gap",
  "keyword_missing",
  "overclaim_risk",
  "formatting_note",
  "other",
];

const WARNING_SEVERITIES: readonly ResumeVersionWarningSeverity[] = ["low", "medium", "high"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trimEnd() : normalized;
}

function sanitizeTextArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = sanitizeText(item, maxLength);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }

  return result;
}

function sanitizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.find((item) => item === normalized) ?? fallback;
}

function sanitizeScore(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeSkillCategories(value: unknown): ResumeVersionSkillCategory[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionSkillCategory[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const category = sanitizeText(item.category, 60);
    const skills = sanitizeTextArray(item.skills, RESUME_TAILORING_LIMITS.skillsPerCategory, 60);
    if (!category || skills.length === 0) continue;
    result.push({ category, skills });
    if (result.length >= RESUME_TAILORING_LIMITS.technicalCategories) break;
  }

  return result;
}

function sanitizeBullets(value: unknown, maxItems: number): ResumeVersionExperienceBullet[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionExperienceBullet[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const tailored = sanitizeText(item.tailored, RESUME_TAILORING_LIMITS.longText);
    if (!tailored) continue;

    const evidenceStrength = sanitizeEnum(item.evidenceStrength, EVIDENCE_STRENGTHS, "medium");
    // Truth-safety: unsupported bullets never reach the tailored resume body.
    if (evidenceStrength === "none") continue;

    const original = sanitizeText(item.original, RESUME_TAILORING_LIMITS.longText);
    const rationale = sanitizeText(item.rationale, RESUME_TAILORING_LIMITS.shortText);

    result.push({
      source: sanitizeText(item.source, RESUME_TAILORING_LIMITS.shortText) || "Resume",
      ...(original ? { original } : {}),
      tailored,
      ...(rationale ? { rationale } : {}),
      evidenceStrength,
    });

    if (result.length >= maxItems) break;
  }

  return result;
}

function sanitizeKeywordCoverage(value: unknown): ResumeVersionKeywordCoverageItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: ResumeVersionKeywordCoverageItem[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const keyword = sanitizeText(item.keyword, 80);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const evidenceStrength = sanitizeEnum(item.evidenceStrength, EVIDENCE_STRENGTHS, "none");
    let action = sanitizeEnum(item.action, KEYWORD_ACTIONS, "add_to_roadmap");
    let usedInTailoredResume = sanitizeBoolean(item.usedInTailoredResume, false);

    // Truth-safety: a keyword with no evidence can never be presented as used experience.
    if (evidenceStrength === "none") {
      usedInTailoredResume = false;
      if (action === "use_safely" || action === "move_higher") {
        action = "add_to_roadmap";
      }
    }

    const note = sanitizeText(item.note, RESUME_TAILORING_LIMITS.shortText);

    result.push({
      keyword,
      type: sanitizeEnum(item.type, KEYWORD_TYPES, "other"),
      importance: sanitizeEnum(item.importance, KEYWORD_IMPORTANCES, "medium"),
      requiredByJob: sanitizeBoolean(item.requiredByJob, true),
      presentInOriginalResume: sanitizeBoolean(item.presentInOriginalResume, false),
      usedInTailoredResume,
      evidenceStrength,
      action,
      ...(note ? { note } : {}),
    });

    if (result.length >= RESUME_TAILORING_LIMITS.keywordCoverage) break;
  }

  return result;
}

function sanitizeWarnings(value: unknown): ResumeVersionWarning[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionWarning[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const message = sanitizeText(item.message, RESUME_TAILORING_LIMITS.longText);
    if (!message) continue;
    const recommendation = sanitizeText(item.recommendation, RESUME_TAILORING_LIMITS.shortText);

    result.push({
      type: sanitizeEnum(item.type, WARNING_TYPES, "other"),
      severity: sanitizeEnum(item.severity, WARNING_SEVERITIES, "medium"),
      message,
      ...(recommendation ? { recommendation } : {}),
    });

    if (result.length >= RESUME_TAILORING_LIMITS.warnings) break;
  }

  return result;
}

function sanitizeChangeLog(value: unknown): ResumeVersionChangeLogItem[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionChangeLogItem[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const change = sanitizeText(item.change, RESUME_TAILORING_LIMITS.longText);
    if (!change) continue;

    result.push({
      section: sanitizeText(item.section, 80) || "Resume",
      change,
      reason: sanitizeText(item.reason, RESUME_TAILORING_LIMITS.shortText),
    });

    if (result.length >= RESUME_TAILORING_LIMITS.changeLog) break;
  }

  return result;
}

function sanitizeEvidenceNotes(value: unknown): ResumeVersionEvidenceNote[] {
  if (!Array.isArray(value)) return [];
  const result: ResumeVersionEvidenceNote[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const claim = sanitizeText(item.claim, RESUME_TAILORING_LIMITS.shortText);
    if (!claim) continue;

    const strength = sanitizeEnum(item.strength, EVIDENCE_STRENGTHS, "none");

    result.push({
      claim,
      evidence: sanitizeText(item.evidence, RESUME_TAILORING_LIMITS.longText),
      strength,
      // Truth-safety: an unsupported claim is never marked safe to use.
      safeToUse: strength === "none" ? false : sanitizeBoolean(item.safeToUse, false),
    });

    if (result.length >= RESUME_TAILORING_LIMITS.evidenceNotes) break;
  }

  return result;
}

export type SanitizedResumeTailoring = {
  tailoredTitle: string;
  content: ResumeVersionContent;
  keywordCoverage: ResumeVersionKeywordCoverageItem[];
  warnings: ResumeVersionWarning[];
  changeLog: ResumeVersionChangeLogItem[];
  evidenceNotes: ResumeVersionEvidenceNote[];
  alignmentScoreBefore: number;
  alignmentScoreAfter: number;
};

export function sanitizeResumeTailoringOutput(
  payload: ResumeTailoringAIPayload | unknown,
  options: { fallbackAlignmentBefore: number },
): SanitizedResumeTailoring | null {
  if (!isRecord(payload)) return null;

  const alignmentScoreBefore = sanitizeScore(
    payload.alignmentScoreBefore,
    options.fallbackAlignmentBefore,
  );
  const rawAfter = sanitizeScore(payload.alignmentScoreAfter, alignmentScoreBefore);
  const alignmentScoreAfter = Math.min(
    rawAfter,
    alignmentScoreBefore + RESUME_TAILORING_LIMITS.maxAlignmentGain,
  );

  const content: ResumeVersionContent = {
    summary: sanitizeText(payload.summary, RESUME_TAILORING_LIMITS.summary),
    coreSkills: sanitizeTextArray(payload.coreSkills, RESUME_TAILORING_LIMITS.coreSkills, 60),
    technicalSkills: sanitizeSkillCategories(payload.technicalSkills),
    experienceBullets: sanitizeBullets(
      payload.experienceBullets,
      RESUME_TAILORING_LIMITS.experienceBullets,
    ),
    projects: sanitizeBullets(payload.projects, RESUME_TAILORING_LIMITS.projects),
    education: sanitizeTextArray(payload.education, RESUME_TAILORING_LIMITS.education, 200),
    certifications: sanitizeTextArray(
      payload.certifications,
      RESUME_TAILORING_LIMITS.certifications,
      200,
    ),
  };

  return {
    tailoredTitle: sanitizeText(payload.tailoredTitle, RESUME_TAILORING_LIMITS.tailoredTitle),
    content,
    keywordCoverage: sanitizeKeywordCoverage(payload.keywordCoverage),
    warnings: sanitizeWarnings(payload.warnings),
    changeLog: sanitizeChangeLog(payload.changeLog),
    evidenceNotes: sanitizeEvidenceNotes(payload.evidenceNotes),
    alignmentScoreBefore,
    alignmentScoreAfter,
  };
}

export function isValidResumeTailoring(value: SanitizedResumeTailoring | null): boolean {
  if (!value) return false;
  if (value.content.summary.length < 40) return false;

  const hasBody =
    value.content.coreSkills.length > 0 ||
    value.content.technicalSkills.length > 0 ||
    value.content.experienceBullets.length > 0 ||
    value.content.projects.length > 0;

  return hasBody;
}
