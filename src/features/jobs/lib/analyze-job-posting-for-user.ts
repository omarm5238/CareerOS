import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { prisma } from "@/server/db/prisma";

import { buildJobMatchInput, resolveJobMatchAnalysis } from "../ai";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import { jobMatchAnalysisToPrismaData } from "./job-match-analysis-to-prisma";
import type { JobDetailView } from "../types";

export async function analyzeJobPostingForUser(
  userId: string,
  jobId: string,
): Promise<JobDetailView | null> {
  const job = await prisma.jobPosting.findFirst({
    where: {
      id: jobId,
      userId,
    },
    include: { analysis: true },
  });

  if (!job) return null;

  const resume = await getLatestResumeAnalysisForUser(userId);
  const matchInput = buildJobMatchInput(
    {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      source: job.source,
      jobUrl: job.jobUrl,
    },
    resume,
  );
  const analysis = await resolveJobMatchAnalysis(matchInput);
  const analysisData = jobMatchAnalysisToPrismaData(analysis);

  if (job.analysis) {
    await prisma.jobAnalysis.update({
      where: { jobPostingId: job.id },
      data: analysisData,
    });
  } else {
    await prisma.jobAnalysis.create({
      data: {
        jobPostingId: job.id,
        ...analysisData,
      },
    });
  }

  const updated = await prisma.jobPosting.findFirst({
    where: { id: job.id, userId },
    include: { analysis: true },
  });

  if (!updated) return null;
  return mapJobPostingToDetailView(updated);
}
