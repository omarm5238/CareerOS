import { getCurrentResumeContextForUser } from "@/features/resume/server";
import { prisma } from "@/server/db/prisma";

import { buildJobMatchInput, resolveJobMatchAnalysis } from "../ai";
import type { CreateJobPostingInput, JobDetailView } from "../types";
import { stampCanonicalJobMatch } from "../matching/stamp-job-match";
import { jobMatchAnalysisToPrismaData } from "./job-match-analysis-to-prisma";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";

export async function createJobPostingForUser(
  userId: string,
  input: CreateJobPostingInput,
): Promise<JobDetailView> {
  const resumeContext = await getCurrentResumeContextForUser(userId);
  const resume = resumeContext.status === "CURRENT" ? resumeContext.analysis : null;
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
  const analysis = await stampCanonicalJobMatch(
    userId,
    {
      title: input.title,
      description: input.description,
      location: input.location ?? null,
    },
    await resolveJobMatchAnalysis(matchInput),
  );

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
