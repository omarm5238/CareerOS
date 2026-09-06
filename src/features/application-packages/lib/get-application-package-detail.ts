import { prisma } from "@/server/db/prisma";

import type { JobEvidenceMatchStrength, JobRequirementCategory, JobRequirementImportance } from "@/generated/prisma/client";

import { getOpportunityAnalysisForUser } from "@/features/jobs/opportunities/lib/analyze-job-opportunity";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";
import { normalizeToken } from "@/features/jobs/opportunities/lib/hash";

import { buildApplicationPackageFingerprint } from "./application-package-fingerprint";
import {
  parseEligibility,
  parseGaps,
  parseOpportunitySnapshot,
  parseQaSnapshot,
  parseRequiredUserInputs,
  parseWarnings,
} from "./json-parsers";
import type { ApplicationPackageView } from "../types";
import type { JobRequirementView } from "@/features/jobs/opportunities/types";

export async function getApplicationPackageDetail(
  userId: string,
  packageId: string,
): Promise<ApplicationPackageView> {
  const row = await prisma.applicationPackage.findFirst({
    where: { id: packageId, userId },
    include: {
      jobPosting: { select: { id: true, title: true, company: true, location: true, jobUrl: true, description: true } },
      resumeVersion: { select: { id: true, title: true, status: true, activeRevisionId: true } },
      resumeVersionRevision: { select: { id: true, revisionNumber: true } },
      coverLetterDraft: { select: { id: true, status: true, activeRevisionId: true, activeRevision: { select: { content: true } } } },
      application: { select: { id: true, status: true } },
    },
  });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");

  const snapshot = parseOpportunitySnapshot(row.opportunitySnapshotJson);
  const evidence = Array.isArray(row.evidenceSnapshotJson) ? row.evidenceSnapshotJson : [];
  const requirements: JobRequirementView[] = (evidence as Array<Record<string, unknown>>).map((item) => {
    const matches = Array.isArray(item.evidence) ? item.evidence : [];
    const mapped = matches.map((match) => {
      const record = match as Record<string, unknown>;
      return {
        evidenceType: "RESUME" as const,
        evidenceSourceId: null,
        evidenceLabel: String(record.evidenceLabel ?? ""),
        evidenceExcerpt: typeof record.evidenceExcerpt === "string" ? record.evidenceExcerpt : null,
        matchStrength: (record.matchStrength as JobEvidenceMatchStrength) ?? "NONE",
        reasoning: typeof record.reasoning === "string" ? record.reasoning : null,
      };
    });
    return {
      id: String(item.id ?? ""),
      category: (item.category as JobRequirementCategory) ?? "OTHER",
      importance: (item.importance as JobRequirementImportance) ?? "UNKNOWN",
      normalizedName: String(item.normalizedName ?? ""),
      rawText: String(item.normalizedName ?? ""),
      sourceExcerpt: String(item.sourceExcerpt ?? ""),
      yearsRequired: null,
      isExplicit: true,
      bestMatch: mapped[0] ?? null,
      evidence: mapped,
    };
  });

  const requiredUserInputs = parseRequiredUserInputs(row.requiredUserInputsJson);
  const qa = parseQaSnapshot(row.qaSnapshotJson);
  const coverLetterRequired = requirements.some((item) => normalizeToken(item.normalizedName).includes("cover letter"));

  let stale = false;
  if (row.jobPostingId && row.status === "READY_FOR_REVIEW") {
    try {
      const [current, liveRequirements] = await Promise.all([
        getOpportunityAnalysisForUser(userId, row.jobPostingId),
        prisma.jobRequirement.findMany({
          where: { userId, jobPostingId: row.jobPostingId },
          select: { id: true },
        }),
      ]);
      if (current) {
        const currentFingerprint = buildApplicationPackageFingerprint({
          jobFingerprint: current.contextFingerprint,
          analysisFingerprint: current.contextFingerprint,
          requirementSignal: liveRequirements.map((item) => item.id).sort().join(","),
          resumeVersionRevisionId: row.resumeVersion?.activeRevisionId ?? row.resumeVersionRevisionId,
          coverLetterRevisionId: row.coverLetterDraft?.activeRevisionId ?? null,
          coverLetterContentSignal: row.coverLetterDraft?.activeRevision?.content.slice(0, 400) ?? null,
          emailRevisionId: null,
          requiredInputs: requiredUserInputs.map((item) => `${item.key}:${item.resolved}:${item.value ?? ""}`).join(","),
        });
        stale = currentFingerprint !== row.contextFingerprint;
      }
    } catch {
      stale = false;
    }
  }

  const userFacingState =
    row.status === "ARCHIVED"
      ? "ARCHIVED"
      : row.status === "SUBMITTED"
        ? "SUBMITTED"
        : row.status === "SUBMISSION_STARTED"
          ? "SUBMISSION_STARTED"
          : row.status === "APPROVED"
            ? "APPROVED"
            : row.readinessStatus === "BLOCKED"
              ? "BLOCKED"
              : row.readinessStatus === "READY"
                ? "READY_TO_APPLY"
                : "NEEDS_YOUR_INPUT";

  return {
    id: row.id,
    version: row.version,
    jobPostingId: row.jobPostingId,
    applicationId: row.applicationId,
    jobTitle: row.jobPosting?.title ?? String(snapshot.jobTitle ?? "Saved job"),
    company: row.jobPosting?.company ?? String(snapshot.company ?? "Unknown company"),
    location: row.jobPosting?.location ?? null,
    workMode: null,
    applyUrl: row.jobPosting?.jobUrl ?? null,
    status: row.status,
    readinessStatus: row.readinessStatus,
    qaStatus: row.qaStatus,
    userFacingState,
    opportunityScore: typeof snapshot.opportunityScore === "number" ? snapshot.opportunityScore : null,
    priorityBand: (snapshot.priorityBand as ApplicationPackageView["priorityBand"]) ?? null,
    evidenceCoverage: typeof snapshot.evidenceCoverage === "number" ? snapshot.evidenceCoverage : null,
    applicationEffort: (snapshot.applicationEffort as ApplicationPackageView["applicationEffort"]) ?? null,
    eligibilityStatus: typeof snapshot.eligibilityStatus === "string" ? snapshot.eligibilityStatus : null,
    resumeVersionId: row.resumeVersionId,
    resumeVersionRevisionId: row.resumeVersionRevisionId,
    resumeTitle: row.resumeVersion?.title ?? null,
    resumeRevisionNumber: row.resumeVersionRevision?.revisionNumber ?? null,
    resumeStatus: row.resumeVersion?.status ?? null,
    coverLetterDraftId: row.coverLetterDraftId,
    coverLetterRequired,
    coverLetterStatus: row.coverLetterDraft?.status ?? null,
    applicationEmailDraftId: row.applicationEmailDraftId,
    whyYouMatch: Array.isArray(snapshot.whyYouMatch) ? (snapshot.whyYouMatch as string[]) : [],
    requirements,
    gaps: parseGaps(row.gapSnapshotJson),
    eligibilityChecks: parseEligibility(row.eligibilitySnapshotJson),
    requiredUserInputs,
    qa,
    warnings: parseWarnings(row.warningsJson),
    stale,
    contextFingerprint: row.contextFingerprint,
    preparedAt: row.preparedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    submissionStartedAt: row.submissionStartedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}
