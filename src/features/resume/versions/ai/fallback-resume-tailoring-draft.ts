import type {
  ResumeVersionChangeLogItem,
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionExperienceBullet,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionWarning,
} from "../types";
import { buildResumeVersionInputSnapshot } from "./build-resume-tailoring-input";
import { RESUME_TAILORING_LIMITS } from "./parse-resume-tailoring-output";
import type { ResumeTailoringInput, ResumeTailoringResult } from "./types";

const BULLET_PREFIX = /^[-•*·–—]\s+/;
const FALLBACK_ALIGNMENT_GAIN = 4;

/**
 * Pulls verbatim bullet lines out of the stored resume text.
 * Nothing is rewritten here, so the fallback cannot invent experience.
 */
function extractVerbatimBullets(resumeText: string): ResumeVersionExperienceBullet[] {
  const bullets: ResumeVersionExperienceBullet[] = [];

  for (const rawLine of resumeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!BULLET_PREFIX.test(line)) continue;

    const text = line.replace(BULLET_PREFIX, "").replace(/\s+/g, " ").trim();
    if (text.length < 25 || text.length > RESUME_TAILORING_LIMITS.longText) continue;

    bullets.push({
      source: "Original resume",
      original: text,
      tailored: text,
      rationale: "Kept verbatim from the original resume.",
      evidenceStrength: "strong",
    });

    if (bullets.length >= RESUME_TAILORING_LIMITS.experienceBullets) break;
  }

  return bullets;
}

function buildFallbackSummary(input: ResumeTailoringInput): string {
  const existing = input.resume.profileSummary?.replace(/\s+/g, " ").trim();
  const targeting = `Targeting the ${input.job.title} role at ${input.job.company}.`;

  if (existing) {
    return `${existing} ${targeting}`.slice(0, RESUME_TAILORING_LIMITS.summary);
  }

  return `${input.resume.experienceLevel} ${input.resume.detectedRole} profile built from the uploaded resume. ${targeting}`.slice(
    0,
    RESUME_TAILORING_LIMITS.summary,
  );
}

function buildFallbackKeywordCoverage(
  input: ResumeTailoringInput,
): ResumeVersionKeywordCoverageItem[] {
  const coverage: ResumeVersionKeywordCoverageItem[] = [];
  const seen = new Set<string>();

  for (const skill of input.job.matchedSkills) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    coverage.push({
      keyword: skill,
      type: "technical_skill",
      importance: "high",
      requiredByJob: true,
      presentInOriginalResume: true,
      usedInTailoredResume: true,
      evidenceStrength: "strong",
      action: "use_safely",
      note: "Matched between the resume and the job posting.",
    });
    if (coverage.length >= RESUME_TAILORING_LIMITS.keywordCoverage) return coverage;
  }

  for (const skill of input.job.missingSkills) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    coverage.push({
      keyword: skill,
      type: "technical_skill",
      importance: "high",
      requiredByJob: true,
      presentInOriginalResume: false,
      usedInTailoredResume: false,
      evidenceStrength: "none",
      action: "add_to_roadmap",
      note: "No supporting evidence in the resume. Build evidence before claiming it.",
    });
    if (coverage.length >= RESUME_TAILORING_LIMITS.keywordCoverage) return coverage;
  }

  for (const blocker of input.job.nonSkillBlockers) {
    const key = blocker.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    coverage.push({
      keyword: blocker,
      type: "experience",
      importance: "medium",
      requiredByJob: true,
      presentInOriginalResume: false,
      usedInTailoredResume: false,
      evidenceStrength: "none",
      action: "keep_out_of_resume",
      note: "Non-skill requirement. Cannot be solved by rewording the resume.",
    });
    if (coverage.length >= RESUME_TAILORING_LIMITS.keywordCoverage) return coverage;
  }

  return coverage;
}

function buildFallbackWarnings(input: ResumeTailoringInput): ResumeVersionWarning[] {
  const warnings: ResumeVersionWarning[] = [
    {
      type: "other",
      severity: "medium",
      message:
        "AI tailoring was unavailable, so this is a conservative rule-based draft built from your existing resume content.",
      recommendation: "Regenerate later to get an AI-tailored revision.",
    },
  ];

  if (input.job.missingSkills.length > 0) {
    warnings.push({
      type: "missing_evidence",
      severity: "high",
      message: `The job asks for ${input.job.missingSkills.slice(0, 5).join(", ")} and your resume has no supporting evidence.`,
      recommendation:
        "Build real evidence through a project or task, then add it to the resume.",
    });
  }

  for (const blocker of input.job.nonSkillBlockers.slice(0, 3)) {
    warnings.push({
      type: "seniority_gap",
      severity: "medium",
      message: `Requirement not covered by your resume: ${blocker}.`,
      recommendation: "Address this directly in your application instead of the resume body.",
    });
  }

  if (input.resume.textPreviewTruncated) {
    warnings.push({
      type: "formatting_note",
      severity: "low",
      message: "Only part of the stored resume text was used to build this draft.",
      recommendation: "Review each section before using this version.",
    });
  }

  return warnings.slice(0, RESUME_TAILORING_LIMITS.warnings);
}

function buildFallbackEvidenceNotes(input: ResumeTailoringInput): ResumeVersionEvidenceNote[] {
  const notes: ResumeVersionEvidenceNote[] = [];

  for (const skill of input.job.matchedSkills.slice(0, 8)) {
    notes.push({
      claim: skill,
      evidence: "Listed in the detected skills of your latest resume analysis.",
      strength: "strong",
      safeToUse: true,
    });
  }

  for (const skill of input.job.missingSkills.slice(0, 8)) {
    notes.push({
      claim: skill,
      evidence: "No supporting evidence found in the resume.",
      strength: "none",
      safeToUse: false,
    });
  }

  return notes.slice(0, RESUME_TAILORING_LIMITS.evidenceNotes);
}

export function buildFallbackResumeTailoringDraft(
  input: ResumeTailoringInput,
): ResumeTailoringResult {
  const matched = input.job.matchedSkills;
  const detected = input.resume.detectedSkills;

  const coreSkills: string[] = [];
  const seen = new Set<string>();
  for (const skill of [...matched, ...detected]) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    coreSkills.push(skill);
    if (coreSkills.length >= RESUME_TAILORING_LIMITS.coreSkills) break;
  }

  const experienceBullets = extractVerbatimBullets(input.resume.textPreview);

  const content: ResumeVersionContent = {
    summary: buildFallbackSummary(input),
    coreSkills,
    technicalSkills:
      detected.length > 0
        ? [
            {
              category: "Skills from resume",
              skills: detected.slice(0, RESUME_TAILORING_LIMITS.skillsPerCategory),
            },
          ]
        : [],
    experienceBullets,
    projects: [],
    education: [],
    certifications: [],
  };

  const changeLog: ResumeVersionChangeLogItem[] = [
    {
      section: "Core Skills",
      change: "Moved skills that match this job to the top of the list.",
      reason: "Job-relevant skills should be seen first by a recruiter or ATS.",
    },
    {
      section: "Professional Summary",
      change: "Kept your existing summary and appended the target role.",
      reason: "Rule-based mode does not rewrite prose, so nothing can be invented.",
    },
  ];

  if (experienceBullets.length > 0) {
    changeLog.push({
      section: "Experience",
      change: "Carried bullets over verbatim from the original resume.",
      reason: "Without AI, bullets are reused exactly rather than rewritten.",
    });
  }

  const alignmentScoreBefore = input.job.matchScore ?? 40;
  const alignmentScoreAfter = Math.min(100, alignmentScoreBefore + FALLBACK_ALIGNMENT_GAIN);

  return {
    tailoredTitle: `${input.job.title} — ${input.job.company}`,
    content,
    keywordCoverage: buildFallbackKeywordCoverage(input),
    warnings: buildFallbackWarnings(input),
    changeLog: changeLog.slice(0, RESUME_TAILORING_LIMITS.changeLog),
    evidenceNotes: buildFallbackEvidenceNotes(input),
    inputSnapshot: buildResumeVersionInputSnapshot(input),
    alignmentScoreBefore,
    alignmentScoreAfter,
    aiSource: "rule_based",
    model: null,
  };
}
