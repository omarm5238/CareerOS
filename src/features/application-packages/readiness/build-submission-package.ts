import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { getCurrentResumeAnalysis, getCurrentResumeContextForUser } from "@/features/resume/provenance";
import { prisma } from "@/server/db/prisma";

import { hashSubmissionPackage } from "../provenance/package-hash";
import { evaluateApplicationReadiness, type ApplicationReadinessResult } from "./evaluate-application-readiness";

export type BuildSubmissionPackageOptions = {
  forceNew?: boolean;
  tailoredResumeVersionId: string;
  tailoredResumeRevisionId: string;
  communicationDraftId?: string | null;
  communicationRevisionId?: string | null;
  communicationRequired?: boolean;
  provider?: string | null;
};

/**
 * Same semantic inputs reuse the latest non-submitted package.
 * forceNew always appends a new package version and never overwrites a locked package.
 */
export async function buildSubmissionPackage(
  userId: string,
  jobPostingId: string,
  options: BuildSubmissionPackageOptions,
): Promise<{ packageId: string; reused: boolean; packageHash: string; readiness: ApplicationReadinessResult }> {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, userId },
    select: { id: true, title: true, company: true, location: true, description: true },
  });
  if (!job) throw new OpportunityAccessError("NOT_FOUND", "Job not found.");

  const context = await getCurrentResumeContextForUser(userId);
  if (context.status !== "CURRENT") {
    throw new OpportunityAccessError("INVALID_INPUT", context.status === "NO_ACTIVE_RESUME" ? "NO_ACTIVE_RESUME" : "CURRENT_RESUME_ANALYSIS_MISSING");
  }
  const analysis = await getCurrentResumeAnalysis(userId);
  if (!analysis) throw new OpportunityAccessError("INVALID_INPUT", "CURRENT_RESUME_ANALYSIS_MISSING");

  const jobSnapshotHash = hashJobSnapshot(job);
  const snapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
    where: {
      userId,
      jobPostingId,
      resumeRevisionId: context.revision.revisionId,
      resumeContentHash: context.revision.contentHash,
      resumeAnalysisId: analysis.analysisId,
      jobSnapshotHash,
      status: { notIn: ["STALE", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) throw new OpportunityAccessError("INVALID_INPUT", "CURRENT_OPPORTUNITY_MISSING");

  const tailored = await prisma.resumeVersionRevision.findFirst({
    where: { id: options.tailoredResumeRevisionId, userId, resumeVersionId: options.tailoredResumeVersionId },
    select: { id: true },
  });
  if (!tailored) throw new OpportunityAccessError("INVALID_INPUT", "TAILORED_RESUME_MISSING");

  const identity = {
    jobPostingId,
    jobSnapshotHash,
    opportunityAnalysisSnapshotId: snapshot.id,
    sourceResumeRevisionId: context.revision.revisionId,
    sourceResumeContentHash: context.revision.contentHash,
    resumeAnalysisId: analysis.analysisId,
    tailoredResumeVersionId: options.tailoredResumeVersionId,
    tailoredResumeRevisionId: options.tailoredResumeRevisionId,
    communicationDraftId: options.communicationDraftId ?? null,
    communicationRevisionId: options.communicationRevisionId ?? null,
    provider: options.provider ?? null,
  };
  const packageHash = hashSubmissionPackage(identity);
  const latest = await prisma.applicationPackage.findFirst({
    where: { userId, jobPostingId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, packageHash: true, status: true, lockedAt: true },
  });

  if (!options.forceNew && latest && latest.packageHash === packageHash && latest.status !== "SUBMITTED" && latest.status !== "ARCHIVED") {
    const readiness = await evaluateApplicationReadiness(userId, latest.id);
    return { packageId: latest.id, reused: true, packageHash, readiness };
  }

  const saved = await prisma.applicationPackage.create({
    data: {
      userId,
      jobPostingId,
      version: (latest?.version ?? 0) + 1,
      resumeVersionId: options.tailoredResumeVersionId,
      resumeVersionRevisionId: options.tailoredResumeRevisionId,
      coverLetterDraftId: options.communicationDraftId ?? null,
      coverLetterRevisionId: options.communicationRevisionId ?? null,
      contextFingerprint: packageHash,
      opportunityAnalysisSnapshotId: snapshot.id,
      sourceResumeRevisionId: context.revision.revisionId,
      sourceResumeContentHash: context.revision.contentHash,
      resumeAnalysisId: analysis.analysisId,
      packageHash,
      packageJson: { ...identity, communicationRequired: options.communicationRequired === true },
      lockedAt: new Date(),
      status: "READY_FOR_REVIEW",
      readinessStatus: "NEEDS_REVIEW",
    },
  });
  const readiness = await evaluateApplicationReadiness(userId, saved.id);
  await prisma.applicationPackage.update({
    where: { id: saved.id },
    data: {
      readinessStatus: readiness.status === "READY" ? "READY" : readiness.status === "REVIEW_REQUIRED" ? "NEEDS_REVIEW" : "BLOCKED",
    },
  });
  return { packageId: saved.id, reused: false, packageHash, readiness };
}
