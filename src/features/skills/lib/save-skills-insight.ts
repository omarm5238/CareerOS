import { prisma } from "@/server/db/prisma";

import type { SkillsInsightResult } from "../ai/types";

export async function saveSkillsInsight(input: {
  userId: string;
  resumeAnalysisId: string | null;
  jobCount: number;
  result: SkillsInsightResult;
}) {
  return prisma.skillsInsight.create({
    data: {
      userId: input.userId,
      resumeAnalysisId: input.resumeAnalysisId,
      jobCount: input.jobCount,
      analysisSource: input.result.analysisSource,
      aiModel: input.result.aiModel ?? null,
      skillCoverageScore: input.result.skillCoverageScore,
      prioritySkills: input.result.prioritySkills,
      learningRoadmap: input.result.learningRoadmap,
      projectIdeas: input.result.projectIdeas,
      resumeSkillAdvice: input.result.resumeSkillAdvice,
      marketSignals: input.result.marketSignals,
      warnings: input.result.warnings,
    },
  });
}
