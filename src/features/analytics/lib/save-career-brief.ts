import { prisma } from "@/server/db/prisma";

import type { CareerBriefResult } from "../ai/types";

export async function saveCareerBrief(input: {
  userId: string;
  result: CareerBriefResult;
}) {
  return prisma.careerBrief.create({
    data: {
      userId: input.userId,
      analysisSource: input.result.analysisSource,
      aiModel: input.result.aiModel ?? null,
      healthScore: input.result.healthScore,
      headline: input.result.headline,
      summary: input.result.summary,
      topRisks: input.result.topRisks,
      topOpportunities: input.result.topOpportunities,
      nextActions: input.result.nextActions,
      thirtyDayPlan: input.result.careerExecutionPlan,
      actionCenter: input.result.actionCenter,
      warnings: [
        ...input.result.warnings,
        ...input.result.dataSourceNotes.map((note) => `[data-note] ${note}`),
      ],
    },
  });
}
