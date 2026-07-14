import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { prisma } from "@/server/db/prisma";

import { buildJobMatchInput, resolveJobMatchAnalysis } from "../ai";
import type { CreateJobPostingInput, JobDetailView } from "../types";
import { jobMatchAnalysisToPrismaData } from "./job-match-analysis-to-prisma";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";

export async function createJobPostingForUser(
  userId: string,
  input: CreateJobPostingInput,
): Promise<JobDetailView> {
  const resume = await getLatestResumeAnalysisForUser(userId);
  const matchInput = buildJobMatchInput(
    {
      title: input.title,
      company: input.company,
      location: input.location ?? null,
      description: input.description,
      source: input.source ?? null,
      jobUrl: input.jobUrl ?? null,
    },
    resume,
  );
  const analysis = await resolveJobMatchAnalysis(matchInput);

  const created = await prisma.jobPosting.create({
    data: {
      userId,
      title: input.title,
      company: input.company,
      location: input.location ?? null,
      jobUrl: input.jobUrl ?? null,
      description: input.description,
      source: input.source ?? null,
      analysis: {
        create: jobMatchAnalysisToPrismaData(analysis),
      },
    },
    include: { analysis: true },
  });

  return mapJobPostingToDetailView(created);
}
