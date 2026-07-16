import type { skillsInsightModel } from "@/generated/prisma/models/skillsInsight";

import type { SkillsInsightView } from "../types";

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

export function mapSkillsInsightToView(record: skillsInsightModel): SkillsInsightView {
  return {
    id: record.id,
    analysisSource: record.analysisSource === "ai" ? "ai" : "rule_based",
    aiModel: record.aiModel,
    skillCoverageScore: record.skillCoverageScore,
    prioritySkills: parseJsonArray(record.prioritySkills),
    learningRoadmap: parseJsonArray(record.learningRoadmap),
    projectIdeas: parseJsonArray(record.projectIdeas),
    resumeSkillAdvice: parseJsonArray(record.resumeSkillAdvice),
    marketSignals: parseJsonArray(record.marketSignals),
    warnings: parseJsonArray(record.warnings),
    jobCount: record.jobCount,
    generatedAt: record.createdAt.toISOString(),
  };
}
