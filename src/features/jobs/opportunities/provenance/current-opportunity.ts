import { CANONICAL_MATCH_VERSION } from "@/features/jobs/matching/canonical-match";
import {
  requireActiveResumeRevision,
  requireCurrentResumeAnalysis,
  ResumeTruthError,
} from "@/features/resume/provenance";
import { prisma } from "@/server/db/prisma";

import { OpportunityTruthError } from "./errors";
import { hashJobSnapshot } from "./hash-job-snapshot";
import { OPPORTUNITY_ANALYZER_VERSION } from "./hash-job-snapshot";

export type CurrentOpportunityAnalysis = {
  snapshotId: string;
  jobPostingId: string;
  legacyAnalysisId: string | null;
  resumeDocumentId: string;
  resumeRevisionId: string;
  resumeContentHash: string;
  resumeAnalysisId: string;
  jobSnapshotHash: string;
  canonicalMatchVersion: string;
  opportunityAnalyzerVersion: string;
  createdAt: Date;
};

async function markIncompatibleSnapshots(input: {
  userId: string;
  jobPostingId: string;
  resumeRevisionId: string;
  resumeContentHash: string;
  resumeAnalysisId: string;
  jobSnapshotHash: string;
}) {
  await prisma.opportunityAnalysisSnapshot.updateMany({
    where: {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      status: { notIn: ["STALE", "FAILED"] },
      NOT: {
        resumeRevisionId: input.resumeRevisionId,
        resumeContentHash: input.resumeContentHash,
        resumeAnalysisId: input.resumeAnalysisId,
        jobSnapshotHash: input.jobSnapshotHash,
      },
    },
    data: { status: "STALE" },
  });
}

export async function getCurrentOpportunityAnalysis(input: {
  userId: string;
  jobPostingId: string;
}): Promise<CurrentOpportunityAnalysis | null> {
  const active = await requireActiveResumeRevision(input.userId);
  const analysis = await requireCurrentResumeAnalysis(input.userId);
  const job = await prisma.jobPosting.findFirst({
    where: { id: input.jobPostingId, userId: input.userId },
    select: { id: true, title: true, company: true, location: true, description: true },
  });
  if (!job) return null;
  const jobSnapshotHash = hashJobSnapshot(job);
  await markIncompatibleSnapshots({
    userId: input.userId,
    jobPostingId: job.id,
    resumeRevisionId: active.revisionId,
    resumeContentHash: active.contentHash,
    resumeAnalysisId: analysis.analysisId,
    jobSnapshotHash,
  });
  const snapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
    where: {
      userId: input.userId,
      jobPostingId: job.id,
      resumeRevisionId: active.revisionId,
      resumeContentHash: active.contentHash,
      resumeAnalysisId: analysis.analysisId,
      jobSnapshotHash,
      status: { notIn: ["STALE", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return null;
  if (snapshot.canonicalMatchVersion !== CANONICAL_MATCH_VERSION) return null;
  if (snapshot.opportunityAnalyzerVersion !== OPPORTUNITY_ANALYZER_VERSION) return null;
  return {
    snapshotId: snapshot.id,
    jobPostingId: snapshot.jobPostingId,
    legacyAnalysisId: snapshot.legacyAnalysisId,
    resumeDocumentId: snapshot.resumeDocumentId,
    resumeRevisionId: snapshot.resumeRevisionId,
    resumeContentHash: snapshot.resumeContentHash,
    resumeAnalysisId: snapshot.resumeAnalysisId,
    jobSnapshotHash: snapshot.jobSnapshotHash,
    canonicalMatchVersion: snapshot.canonicalMatchVersion,
    opportunityAnalyzerVersion: snapshot.opportunityAnalyzerVersion,
    createdAt: snapshot.createdAt,
  };
}

export async function assertCurrentOpportunityForPreparation(userId: string, jobPostingId: string) {
  let current: CurrentOpportunityAnalysis | null;
  try {
    current = await getCurrentOpportunityAnalysis({ userId, jobPostingId });
  } catch (error) {
    if (error instanceof ResumeTruthError) {
      if (error.code === "NO_ACTIVE_RESUME") throw new OpportunityTruthError("NO_ACTIVE_RESUME");
      if (error.code === "CURRENT_ANALYSIS_NOT_FOUND") throw new OpportunityTruthError("CURRENT_ANALYSIS_NOT_FOUND");
    }
    throw error;
  }
  if (!current) {
    const anySnapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
      where: { userId, jobPostingId },
      select: { id: true },
    });
    throw new OpportunityTruthError(anySnapshot ? "STALE_OPPORTUNITY_ANALYSIS" : "CURRENT_OPPORTUNITY_ANALYSIS_NOT_FOUND");
  }
  return current;
}
