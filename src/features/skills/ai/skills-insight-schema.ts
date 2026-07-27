import {
  classifyRequirement,
  estimateLearningEffort,
  isValidSkillName,
  normalizeSkillName,
} from "@/features/shared/insights";

import type { SkillPriority } from "../types";
import type {
  SkillsEvidenceStatus,
  SkillsInsightAIPayload,
  SkillsInsightPrioritySkill,
  SkillsInsightProjectIdea,
  SkillsInsightResult,
  SkillsInsightResumeAdvice,
  SkillsInsightRoadmapItem,
} from "./types";

const PRIORITIES: SkillPriority[] = ["High", "Medium", "Low"];
const ACTIONS: SkillsInsightResumeAdvice["action"][] = [
  "Add evidence first",
  "Add to resume",
  "Do not add yet",
];
const EVIDENCE_STATUSES: SkillsEvidenceStatus[] = [
  "missing_from_resume",
  "partially_supported",
  "supported",
  "needs_proof_first",
];

const LIMITS = {
  prioritySkills: 6,
  learningRoadmap: 4,
  projectIdeas: 4,
  resumeSkillAdvice: 6,
  marketSignals: 5,
  warnings: 4,
  skillsPerItem: 8,
  stringField: 500,
  proofField: 400,
} as const;

function sanitizeString(value: unknown, fallback = "", max: number = LIMITS.stringField): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function sanitizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];

  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    items.push(trimmed);
    if (items.length >= max) break;
  }

  return items;
}

function sanitizeScore(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }

  return 0;
}

function sanitizePriority(value: unknown): SkillPriority {
  if (typeof value !== "string") return "Medium";
  const normalized = value.trim();
  if (PRIORITIES.includes(normalized as SkillPriority)) {
    return normalized as SkillPriority;
  }
  return "Medium";
}

function sanitizeAction(value: unknown): SkillsInsightResumeAdvice["action"] {
  if (typeof value !== "string") return "Add evidence first";
  const normalized = value.trim();
  if (ACTIONS.includes(normalized as SkillsInsightResumeAdvice["action"])) {
    return normalized as SkillsInsightResumeAdvice["action"];
  }
  return "Add evidence first";
}

function sanitizeEvidenceStatus(value: unknown, resumeSafe: boolean): SkillsEvidenceStatus {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (EVIDENCE_STATUSES.includes(normalized as SkillsEvidenceStatus)) {
      return normalized as SkillsEvidenceStatus;
    }
  }
  return resumeSafe ? "supported" : "needs_proof_first";
}

function sanitizeBoolean(value: unknown): boolean {
  return value === true;
}

function sanitizePrioritySkills(value: unknown): SkillsInsightPrioritySkill[] {
  if (!Array.isArray(value)) return [];

  const items: SkillsInsightPrioritySkill[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const skill = normalizeSkillName(sanitizeString(record.skill, "", 80));
    if (
      !skill ||
      !isValidSkillName(skill) ||
      classifyRequirement(skill).kind !== "skill"
    ) continue;

    const reason = sanitizeString(
      record.whyThisMatters ?? record.reason,
      "Relevant to your saved jobs and profile.",
    );
    const evidence = sanitizeString(
      record.currentEvidence ?? record.evidence,
      "Based on saved job and resume data.",
    );
    const resumeSafe = sanitizeBoolean(record.resumeSafe);
    const evidenceStatus = sanitizeEvidenceStatus(record.evidenceStatus, resumeSafe);

    items.push({
      skill,
      priority: sanitizePriority(record.priority),
      reason,
      evidence,
      resumeSafe: resumeSafe || evidenceStatus === "supported",
      evidenceStatus,
      whyThisMatters: reason,
      currentEvidence: evidence,
      learningTarget: sanitizeString(
        record.learningTarget,
        `Learn practical ${skill} fundamentals you can demonstrate.`,
      ),
      proofProject: sanitizeString(
        record.proofProject,
        `Build one small project that clearly uses ${skill}.`,
        LIMITS.proofField,
      ),
      estimatedHours: estimateLearningEffort(skill).label,
      resumeRule: sanitizeString(
        record.resumeRule,
        resumeSafe || evidenceStatus === "supported"
          ? "Add to resume if usage is already clear."
          : "Add only after you can show project or work evidence.",
      ),
    });

    if (items.length >= LIMITS.prioritySkills) break;
  }

  return items;
}

function sanitizeLearningRoadmap(value: unknown): SkillsInsightRoadmapItem[] {
  if (!Array.isArray(value)) return [];

  const items: SkillsInsightRoadmapItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = sanitizeString(record.title, "", 120);
    if (!title) continue;

    items.push({
      title,
      skills: sanitizeStringArray(record.skills, LIMITS.skillsPerItem).filter((skill) =>
        isValidSkillName(skill) && classifyRequirement(skill).kind === "skill",
      ),
      timeframe: sanitizeString(record.timeframe, "1-2 weeks", 60),
      outcome: sanitizeString(record.outcome, "Demonstrate practical ability with a small project."),
    });

    if (items.length >= LIMITS.learningRoadmap) break;
  }

  return items;
}

function sanitizeProjectIdeas(value: unknown): SkillsInsightProjectIdea[] {
  if (!Array.isArray(value)) return [];

  const banned = [
    "open-source contribution",
    "certification preparation",
    "impact measurement",
    "soft skills workshop",
  ];

  const items: SkillsInsightProjectIdea[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = sanitizeString(record.title, "", 120);
    if (!title) continue;
    if (banned.some((phrase) => title.toLowerCase().includes(phrase))) continue;

    const skills = sanitizeStringArray(
      record.skillsCovered ?? record.skills,
      LIMITS.skillsPerItem,
    ).filter(
      (skill) =>
        isValidSkillName(skill) && classifyRequirement(skill).kind === "skill",
    );

    const description = sanitizeString(
      record.description,
      `Build a concrete portfolio artifact that proves ${skills[0] ?? "the target skill"}.`,
    );
    const output = sanitizeString(
      record.output,
      "GitHub repo with README and runnable setup instructions.",
    );
    const estimatedHours = estimateLearningEffort(skills[0] ?? title).label;
    const resumeProof = sanitizeString(
      record.resumeProof ?? record.proof,
      "Add to resume only after the repo proves the skill.",
      LIMITS.proofField,
    );

    items.push({
      title,
      skills,
      proof: resumeProof,
      description,
      skillsCovered: skills,
      output,
      estimatedHours,
      resumeProof,
    });

    if (items.length >= LIMITS.projectIdeas) break;
  }

  return items;
}

function sanitizeResumeSkillAdvice(value: unknown): SkillsInsightResumeAdvice[] {
  if (!Array.isArray(value)) return [];

  const items: SkillsInsightResumeAdvice[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const skill = normalizeSkillName(sanitizeString(record.skill, "", 80));
    if (!skill) continue;

    items.push({
      skill,
      advice: sanitizeString(record.advice, "Only add this skill if you can show real evidence."),
      action: sanitizeAction(record.action),
    });

    if (items.length >= LIMITS.resumeSkillAdvice) break;
  }

  return items;
}

export function sanitizeSkillsInsightAIAnalysis(
  payload: SkillsInsightAIPayload,
  model: string,
): SkillsInsightResult | null {
  const skillCoverageScore = sanitizeScore(payload.skillCoverageScore);
  const prioritySkills = sanitizePrioritySkills(payload.prioritySkills);
  const learningRoadmap = sanitizeLearningRoadmap(payload.learningRoadmap);
  const projectIdeas = sanitizeProjectIdeas(payload.projectIdeas);
  const resumeSkillAdvice = sanitizeResumeSkillAdvice(payload.resumeSkillAdvice);
  const marketSignals = sanitizeStringArray(payload.marketSignals, LIMITS.marketSignals);
  const warnings = sanitizeStringArray(payload.warnings, LIMITS.warnings);

  if (
    skillCoverageScore === 0 &&
    prioritySkills.length === 0 &&
    learningRoadmap.length === 0 &&
    marketSignals.length === 0
  ) {
    return null;
  }

  return {
    skillCoverageScore,
    prioritySkills,
    learningRoadmap,
    projectIdeas,
    resumeSkillAdvice,
    marketSignals,
    warnings,
    analysisSource: "ai",
    aiModel: model,
  };
}

export function isValidSkillsInsightResult(result: SkillsInsightResult): boolean {
  return (
    result.skillCoverageScore >= 0 &&
    result.skillCoverageScore <= 100 &&
    result.prioritySkills.length + result.learningRoadmap.length + result.marketSignals.length > 0
  );
}
