import { prisma } from "@/server/db/prisma";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import { analyzeJobMatchRuleBased } from "./analyze-job-match-rule-based";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import type { CreateJobPostingInput, JobDetailView } from "../types";

export async function createJobPostingForUser(
  userId: string,
  input: CreateJobPostingInput,
): Promise<JobDetailView> {
  const resume = await getLatestResumeAnalysisForUser(userId);
  const analysis = analyzeJobMatchRuleBased({
    title: input.title,
    description: input.description,
    resume: resume
      ? {
          role: resume.role,
          experienceLevel: resume.experienceLevel,
          detectedSkills: resume.detectedSkills,
        }
      : null,
  });

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
        create: {
          matchScore: analysis.matchScore,
          roleAlignment: analysis.roleAlignment,
          matchedSkills: analysis.matchedSkills,
          missingSkills: analysis.missingSkills,
          resumeSignals: analysis.resumeSignals,
          jobSignals: analysis.jobSignals,
          recommendations: analysis.recommendations,
        },
      },
    },
    include: { analysis: true },
  });

  return mapJobPostingToDetailView(created);
}
