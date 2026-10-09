import { evaluateCanonicalMatch } from "@/features/jobs/matching/canonical-match";
import { loadCanonicalProfile } from "@/features/jobs/matching/stamp-job-match";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { getCurrentResumeAnalysis, getCurrentResumeContextForUser } from "@/features/resume/provenance";
import { prisma } from "@/server/db/prisma";

import { hashSubmissionPackage, type SubmissionPackageIdentity } from "../provenance/package-hash";

export type ApplicationReadinessState = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

export type ApplicationReadinessResult = {
  status: ApplicationReadinessState;
  blockers: string[];
  warnings: string[];
  provenance: {
    packageId: string | null;
    jobPostingId: string | null;
    sourceResumeRevisionId: string | null;
    sourceResumeContentHash: string | null;
    resumeAnalysisId: string | null;
    opportunityAnalysisSnapshotId: string | null;
    tailoredResumeRevisionId: string | null;
    communicationRevisionId: string | null;
    packageHash: string | null;
    eligibility: string | null;
  };
};

function result(
  status: ApplicationReadinessState,
  blockers: string[],
  warnings: string[],
  provenance: ApplicationReadinessResult["provenance"],
): ApplicationReadinessResult {
  const unique = [...new Set(blockers)];
  return {
    status: unique.length > 0 ? "BLOCKED" : status,
    blockers: unique,
    warnings: [...new Set(warnings)],
    provenance,
  };
}

export async function evaluateApplicationReadiness(
  userId: string,
  packageId: string,
): Promise<ApplicationReadinessResult> {
  const row = await prisma.applicationPackage.findFirst({
    where: { id: packageId, userId },
    include: {
      jobPosting: { select: { id: true, title: true, company: true, location: true, description: true } },
      resumeVersion: { select: { id: true, activeRevisionId: true } },
      submissionAttempts: { select: { status: true, verificationStatus: true } },
    },
  });
  const empty = {
    packageId,
    jobPostingId: null,
    sourceResumeRevisionId: null,
    sourceResumeContentHash: null,
    resumeAnalysisId: null,
    opportunityAnalysisSnapshotId: null,
    tailoredResumeRevisionId: null,
    communicationRevisionId: null,
    packageHash: null,
    eligibility: null,
  };
  if (!row) return result("BLOCKED", ["PACKAGE_MISSING"], [], empty);

  const blockers: string[] = [];
  const warnings: string[] = [];
  const context = await getCurrentResumeContextForUser(userId);
  const currentAnalysis = await getCurrentResumeAnalysis(userId);
  if (context.status === "NO_ACTIVE_RESUME") blockers.push("NO_ACTIVE_RESUME");
  if (context.status === "CURRENT_ANALYSIS_NOT_FOUND" || !currentAnalysis) blockers.push("CURRENT_RESUME_ANALYSIS_MISSING");

  if (context.revision) {
    if (row.sourceResumeRevisionId && row.sourceResumeRevisionId !== context.revision.revisionId) {
      blockers.push("SOURCE_REVISION_MISMATCH", "PACKAGE_STALE");
    }
    if (row.sourceResumeContentHash && row.sourceResumeContentHash !== context.revision.contentHash) {
      blockers.push("RESUME_HASH_MISMATCH", "PACKAGE_STALE");
    }
  }
  if (currentAnalysis && row.resumeAnalysisId && row.resumeAnalysisId !== currentAnalysis.analysisId) {
    blockers.push("RESUME_ANALYSIS_MISMATCH", "PACKAGE_STALE");
  }
  if (row.resumeAnalysisId) {
    const bound = await prisma.resumeAnalysis.findFirst({
      where: { id: row.resumeAnalysisId },
      select: { freshness: true },
    });
    if (bound?.freshness === "STALE") blockers.push("STALE_RESUME_ANALYSIS");
  }

  let eligibility: string | null = null;
  if (row.jobPosting && currentAnalysis) {
    const profile = await loadCanonicalProfile(userId);
    const match = evaluateCanonicalMatch({
      title: row.jobPosting.title,
      description: row.jobPosting.description,
      location: row.jobPosting.location,
    }, profile);
    eligibility = match.eligibility;
    if (match.eligibility === "INELIGIBLE") blockers.push("JOB_INELIGIBLE");
    if (match.eligibility === "REVIEW_REQUIRED") warnings.push("CANONICAL_REVIEW_REQUIRED");

    if (context.status === "CURRENT" && currentAnalysis) {
      const jobSnapshotHash = hashJobSnapshot(row.jobPosting);
      const currentSnapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
        where: {
          userId,
          jobPostingId: row.jobPosting.id,
          resumeRevisionId: context.revision.revisionId,
          resumeContentHash: context.revision.contentHash,
          resumeAnalysisId: currentAnalysis.analysisId,
          jobSnapshotHash,
          status: { notIn: ["STALE", "FAILED"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!currentSnapshot) blockers.push("CURRENT_OPPORTUNITY_MISSING");
      else if (row.opportunityAnalysisSnapshotId && row.opportunityAnalysisSnapshotId !== currentSnapshot.id) {
        blockers.push("OPPORTUNITY_SNAPSHOT_MISMATCH", "STALE_OPPORTUNITY", "PACKAGE_STALE");
      }
    }
  }

  if (row.opportunityAnalysisSnapshotId) {
    const snapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
      where: { id: row.opportunityAnalysisSnapshotId, userId },
      select: { status: true },
    });
    if (!snapshot) blockers.push("STALE_OPPORTUNITY");
    else if (snapshot.status === "STALE" || snapshot.status === "FAILED") blockers.push("STALE_OPPORTUNITY", "PACKAGE_STALE");
  } else {
    blockers.push("CURRENT_OPPORTUNITY_MISSING");
  }

  if (!row.resumeVersionRevisionId) blockers.push("TAILORED_RESUME_MISSING");
  else if (row.resumeVersion?.activeRevisionId && row.resumeVersion.activeRevisionId !== row.resumeVersionRevisionId) {
    blockers.push("TAILORED_REVISION_MISMATCH", "TAILORED_RESUME_STALE", "PACKAGE_STALE");
  }

  const payload = row.packageJson && typeof row.packageJson === "object" && !Array.isArray(row.packageJson)
    ? row.packageJson as Record<string, unknown>
    : {};
  const communicationRequired = payload.communicationRequired === true;
  if (communicationRequired && !row.coverLetterRevisionId) blockers.push("REQUIRED_COMMUNICATION_MISSING");
  if (row.coverLetterDraftId && row.coverLetterRevisionId) {
    const draft = await prisma.communicationDraft.findFirst({
      where: { id: row.coverLetterDraftId, userId },
      select: { activeRevisionId: true },
    });
    if (draft?.activeRevisionId && draft.activeRevisionId !== row.coverLetterRevisionId) {
      blockers.push("COMMUNICATION_REVISION_MISMATCH", "PACKAGE_STALE");
    }
  }

  if (row.packageHash && row.jobPostingId && row.opportunityAnalysisSnapshotId && row.sourceResumeRevisionId && row.sourceResumeContentHash && row.resumeAnalysisId) {
    const snapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
      where: { id: row.opportunityAnalysisSnapshotId },
      select: { jobSnapshotHash: true },
    });
    if (snapshot) {
      const identity: SubmissionPackageIdentity = {
        jobPostingId: row.jobPostingId,
        jobSnapshotHash: snapshot.jobSnapshotHash,
        opportunityAnalysisSnapshotId: row.opportunityAnalysisSnapshotId,
        sourceResumeRevisionId: row.sourceResumeRevisionId,
        sourceResumeContentHash: row.sourceResumeContentHash,
        resumeAnalysisId: row.resumeAnalysisId,
        tailoredResumeVersionId: row.resumeVersionId,
        tailoredResumeRevisionId: row.resumeVersionRevisionId,
        communicationDraftId: row.coverLetterDraftId,
        communicationRevisionId: row.coverLetterRevisionId,
        provider: typeof payload.provider === "string" ? payload.provider : null,
      };
      if (hashSubmissionPackage(identity) !== row.packageHash) blockers.push("PACKAGE_PROVENANCE_MISMATCH");
    }
  }

  if (row.submissionAttempts.some((attempt) => attempt.status === "COMPLETED" && attempt.verificationStatus === "VERIFIED")) {
    blockers.push("EXECUTION_ALREADY_CONFIRMED");
  }
  if (row.submissionAttempts.some((attempt) => attempt.status === "UNCERTAIN")) {
    blockers.push("SUBMISSION_UNCERTAIN_REQUIRES_REVIEW");
  }

  return result(warnings.length > 0 ? "REVIEW_REQUIRED" : "READY", blockers, warnings, {
    packageId: row.id,
    jobPostingId: row.jobPostingId,
    sourceResumeRevisionId: row.sourceResumeRevisionId,
    sourceResumeContentHash: row.sourceResumeContentHash,
    resumeAnalysisId: row.resumeAnalysisId,
    opportunityAnalysisSnapshotId: row.opportunityAnalysisSnapshotId,
    tailoredResumeRevisionId: row.resumeVersionRevisionId,
    communicationRevisionId: row.coverLetterRevisionId,
    packageHash: row.packageHash,
    eligibility,
  });
}
