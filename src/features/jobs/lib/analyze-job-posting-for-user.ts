import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { prisma } from "@/server/db/prisma";

import { buildJobMatchInput, resolveJobMatchAnalysis } from "../ai";
import { mapJobPostingToDetailView } from "./map-job-posting-to-view";
import { jobMatchAnalysisToPrismaData } from "./job-match-analysis-to-prisma";
import type { JobDetailView } from "../types";

export type AnalyzeJobPostingResult = {
  job: JobDetailView;
  preserved: boolean;
  message: string;
};

export async function analyzeJobPostingForUser(
  userId: string,
  jobId: string,
): Promise<AnalyzeJobPostingResult | null> {
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
  if (
    analysis.analysisSource === "rule_based" &&
    job.analysis?.analysisSource === "ai"
  ) {
    return {
      job: mapJobPostingToDetailView(job),
      preserved: true,
      message: "AI was unavailable. Previous AI match preserved.",
    };
  }

  if (
    analysis.analysisSource === "rule_based" &&
    job.analysis?.analysisSource === "rule_based"
  ) {
    return {
      job: mapJobPostingToDetailView(job),
      preserved: true,
      message: "AI was unavailable. Provisional match remains.",
    };
  }

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
  return {
    job: mapJobPostingToDetailView(updated),
    preserved: false,
    message:
      analysis.analysisSource === "ai"
        ? "AI match updated."
        : "AI unavailable; provisional rule-based match saved.",
  };
}
