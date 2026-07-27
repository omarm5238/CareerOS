import type { skillsInsightModel } from "@/generated/prisma/models/skillsInsight";
import { isValidSkillName } from "@/features/shared/insights";
import {
  classifyRequirement,
  estimateLearningEffort,
} from "@/features/shared/insights";

import type {
  SkillsEvidenceStatus,
  SkillsInsightPrioritySkill,
  SkillsInsightResumeAdvice,
  SkillsInsightView,
} from "../types";

function parseJsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

function sanitizeEvidenceStatus(
  value: unknown,
  resumeSafe: boolean,
): SkillsEvidenceStatus {
  if (
    value === "missing_from_resume" ||
    value === "partially_supported" ||
    value === "supported" ||
    value === "needs_proof_first"
  ) {
    return value;
  }
  return resumeSafe ? "supported" : "needs_proof_first";
}

function mapPrioritySkill(raw: unknown): SkillsInsightPrioritySkill | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const skill = typeof record.skill === "string" ? record.skill.trim() : "";
  if (
    !skill ||
    !isValidSkillName(skill) ||
    classifyRequirement(skill).kind !== "skill"
  ) return null;

  const priority =
    record.priority === "High" || record.priority === "Medium" || record.priority === "Low"
      ? record.priority
      : "Medium";
  const reason =
    typeof record.whyThisMatters === "string"
      ? record.whyThisMatters
      : typeof record.reason === "string"
        ? record.reason
        : "Relevant to your saved jobs and profile.";
  const evidence =
    typeof record.currentEvidence === "string"
      ? record.currentEvidence
      : typeof record.evidence === "string"
        ? record.evidence
        : "Based on saved job and resume data.";
  const resumeSafe = record.resumeSafe === true;
  const evidenceStatus = sanitizeEvidenceStatus(record.evidenceStatus, resumeSafe);

  return {
    skill,
    priority,
    reason,
    evidence,
    resumeSafe,
    evidenceStatus,
    whyThisMatters: reason,
    currentEvidence: evidence,
    learningTarget:
      typeof record.learningTarget === "string"
        ? record.learningTarget
        : `Practice core ${skill} concepts you can demonstrate.`,
    proofProject:
      typeof record.proofProject === "string"
        ? record.proofProject
        : `Build one small project that clearly uses ${skill}.`,
    estimatedHours: estimateLearningEffort(skill).label,
    resumeRule:
      typeof record.resumeRule === "string"
        ? record.resumeRule
        : resumeSafe
          ? "Safe to keep/add if experience is already visible."
          : "Add only after you can show project or work evidence.",
  };
}

function mapResumeAdvice(raw: unknown): SkillsInsightResumeAdvice | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const skill = typeof record.skill === "string" ? record.skill.trim() : "";
  if (!skill || !isValidSkillName(skill)) return null;
  const action =
    record.action === "Add evidence first" ||
    record.action === "Add to resume" ||
    record.action === "Do not add yet"
      ? record.action
      : "Add evidence first";

  return {
    skill,
    advice:
      typeof record.advice === "string"
        ? record.advice
        : "Only add this skill if you can show real evidence.",
    action,
  };
}

export function mapSkillsInsightToView(
  record: skillsInsightModel,
  freshness?: { isStale: boolean; staleReason: string | null },
): SkillsInsightView {
  return {
    id: record.id,
    analysisSource: record.analysisSource === "ai" ? "ai" : "rule_based",
    aiModel: record.aiModel,
    skillCoverageScore: record.skillCoverageScore,
    prioritySkills: parseJsonArray(record.prioritySkills)
      .map(mapPrioritySkill)
      .filter((item): item is SkillsInsightPrioritySkill => item !== null)
      .slice(0, 6),
    learningRoadmap: parseJsonArray(record.learningRoadmap) as SkillsInsightView["learningRoadmap"],
    projectIdeas: parseJsonArray(record.projectIdeas)
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const item = raw as Record<string, unknown>;
        const title = typeof item.title === "string" ? item.title.trim() : "";
        if (!title) return null;
        const skills = Array.isArray(item.skills)
          ? item.skills.filter((s): s is string => typeof s === "string")
          : [];
        const skillsCovered = Array.isArray(item.skillsCovered)
          ? item.skillsCovered.filter((s): s is string => typeof s === "string")
          : undefined;
        return {
          title,
          skills,
          proof:
            typeof item.resumeProof === "string"
              ? item.resumeProof
              : typeof item.proof === "string"
                ? item.proof
                : "Add to resume only after the project is complete.",
          description: typeof item.description === "string" ? item.description : undefined,
          skillsCovered,
          output: typeof item.output === "string" ? item.output : undefined,
          estimatedHours: (() => {
            const skill = skillsCovered?.[0] ?? skills[0];
            if (!skill) return "Portfolio proof over time";
            const effort = estimateLearningEffort(skill);
            return effort.showHours ? effort.label : effort.label;
          })(),
          resumeProof:
            typeof item.resumeProof === "string"
              ? item.resumeProof
              : typeof item.proof === "string"
                ? item.proof
                : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    resumeSkillAdvice: parseJsonArray(record.resumeSkillAdvice)
      .map(mapResumeAdvice)
      .filter((item): item is SkillsInsightResumeAdvice => item !== null),
    marketSignals: parseJsonArray(record.marketSignals).filter(
      (item): item is string => typeof item === "string",
    ),
    warnings: parseJsonArray(record.warnings).filter(
      (item): item is string => typeof item === "string",
    ),
    jobCount: record.jobCount,
    generatedAt: record.createdAt.toISOString(),
    isStale: freshness?.isStale ?? false,
    staleReason: freshness?.staleReason ?? null,
  };
}
