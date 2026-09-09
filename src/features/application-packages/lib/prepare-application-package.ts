import { prisma } from "@/server/db/prisma";

import { generateCommunicationDraft } from "@/features/communications/lib/generate-communication-draft";
import { analyzeJobOpportunity } from "@/features/jobs/opportunities/lib/analyze-job-opportunity";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";
import { createResumeVersionForJob } from "@/features/resume/versions/lib/create-resume-version-for-job";
import { normalizeToken } from "@/features/jobs/opportunities/lib/hash";

import { buildApplicationPackageFingerprint } from "./application-package-fingerprint";
import { buildRequiredUserInputs, mergePreservedInputs } from "./build-required-user-inputs";
import { calculateApplicationReadiness } from "./calculate-application-readiness";
import { parseRequiredUserInputs, toPrismaJson } from "./json-parsers";
import { acquirePackageLock, releasePackageLock } from "./package-version-lock";
import { runApplicationPackageQa } from "./run-application-package-qa";
import { runResumeQa } from "./run-resume-qa";

export async function prepareApplicationPackage(
  userId: string,
  jobPostingId: string,
  options?: { forceNewPackage?: boolean; queueItemId?: string | null },
) {
  if (process.env.CAREEROS_M245A_FAIL_JOB_ID === jobPostingId) {
    throw new OpportunityAccessError("INVALID_INPUT", "Controlled batch failure for QA.");
  }

  if (!acquirePackageLock(userId, jobPostingId)) {
    const existing = await prisma.applicationPackage.findFirst({
      where: { userId, jobPostingId, status: { notIn: ["ARCHIVED"] } },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, readinessStatus: true, qaStatus: true },
    });
    if (existing) {
      return { packageId: existing.id, version: existing.version, status: existing.status, readinessStatus: existing.readinessStatus, qaStatus: existing.qaStatus, reused: true };
    }
  }

  try {
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobPostingId, userId },
      select: { id: true, title: true, company: true, description: true, jobUrl: true },
    });
    if (!job) throw new OpportunityAccessError("NOT_FOUND", "Job not found.");

    const analysis = await analyzeJobOpportunity(userId, jobPostingId);

    const requirements = await prisma.jobRequirement.findMany({
      where: { userId, jobPostingId },
      include: { evidenceMatches: { orderBy: { createdAt: "asc" } } },
    });

    const resumeCandidates = await prisma.resumeVersion.findMany({
      where: {
        userId,
        targetJobId: jobPostingId,
        status: { in: ["READY", "DRAFT"] },
        archivedAt: null,
      },
      select: { id: true, title: true, status: true, activeRevisionId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    let resume = resumeCandidates.find((item) => item.status === "READY") ?? resumeCandidates[0] ?? null;

    if (!resume) {
      const created = await createResumeVersionForJob({ userId, targetJobId: jobPostingId });
      if (!created.ok) {
        throw new OpportunityAccessError("INVALID_INPUT", created.message);
      }
      const createdResume = await prisma.resumeVersion.findFirst({
        where: { id: created.versionId, userId },
        select: { id: true, title: true, status: true, activeRevisionId: true, updatedAt: true },
      });
      if (!createdResume) {
        throw new OpportunityAccessError("INVALID_INPUT", "A tailored resume could not be resolved.");
      }
      resume = createdResume;
    }
    if (!resume?.activeRevisionId) {
      throw new OpportunityAccessError("INVALID_INPUT", "A tailored resume could not be resolved.");
    }

    const revision = await prisma.resumeVersionRevision.findFirst({
      where: { id: resume.activeRevisionId, userId },
      select: { id: true, revisionNumber: true, contentJson: true },
    });
    if (!revision) throw new OpportunityAccessError("INVALID_INPUT", "Exact resume revision was not found.");

    const coverLetterRequired = requirements.some((row) => normalizeToken(row.normalizedName).includes("cover letter"));
    const applyByEmail = /mailto:|apply by email/i.test(job.description);

    let coverLetterDraftId: string | null = null;
    if (coverLetterRequired) {
      const existingLetter = await prisma.communicationDraft.findFirst({
        where: { userId, jobPostingId, type: "COVER_LETTER", status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (existingLetter) {
        coverLetterDraftId = existingLetter.id;
      } else {
        const generated = await generateCommunicationDraft(userId, {
          jobPostingId,
          resumeVersionId: resume.id,
          resumeVersionRevisionId: revision.id,
          recipientMode: "UNKNOWN",
          type: "COVER_LETTER",
          tone: "PROFESSIONAL",
          length: "STANDARD",
          language: "ENGLISH",
        });
        coverLetterDraftId = generated.draftId;
      }
    }

    let applicationEmailDraftId: string | null = null;
    if (applyByEmail) {
      const existingEmail = await prisma.communicationDraft.findFirst({
        where: { userId, jobPostingId, type: "APPLICATION_EMAIL", status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (existingEmail) {
        applicationEmailDraftId = existingEmail.id;
      } else {
        const generated = await generateCommunicationDraft(userId, {
          jobPostingId,
          resumeVersionId: resume.id,
          resumeVersionRevisionId: revision.id,
          recipientMode: "UNKNOWN",
          type: "APPLICATION_EMAIL",
          tone: "PROFESSIONAL",
          length: "SHORT",
          language: "ENGLISH",
        });
        applicationEmailDraftId = generated.draftId;
      }
    }

    const coverLetter = coverLetterDraftId
      ? await prisma.communicationDraft.findFirst({
          where: { id: coverLetterDraftId, userId },
          select: { id: true, status: true, jobPostingId: true, activeRevisionId: true, activeRevision: { select: { id: true, content: true } } },
        })
      : null;

    const alreadyApplied = await prisma.application.findFirst({
      where: {
        userId,
        jobPostingId,
        status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
      },
      select: { id: true },
    });

    const requiredUserInputs = buildRequiredUserInputs(analysis.eligibilityChecks);
    const latest = await prisma.applicationPackage.findFirst({
      where: { userId, jobPostingId },
      orderBy: { version: "desc" },
    });

    const mergedInputs = mergePreservedInputs(
      requiredUserInputs,
      latest ? parseRequiredUserInputs(latest.requiredUserInputsJson) : [],
    );

    const fingerprint = buildApplicationPackageFingerprint({
      jobFingerprint: analysis.contextFingerprint,
      analysisFingerprint: analysis.contextFingerprint,
      requirementSignal: requirements.map((row) => row.id).sort().join(","),
      resumeVersionRevisionId: revision.id,
      coverLetterRevisionId: coverLetter?.activeRevisionId ?? null,
      coverLetterContentSignal: coverLetter?.activeRevision?.content.slice(0, 400) ?? null,
      emailRevisionId: null,
      requiredInputs: mergedInputs.map((item) => `${item.key}:${item.resolved}:${item.value ?? ""}`).join(","),
    });

    if (!options?.forceNewPackage && latest && latest.contextFingerprint === fingerprint && latest.status !== "APPROVED" && latest.status !== "SUBMITTED" && latest.status !== "ARCHIVED") {
      return {
        packageId: latest.id,
        version: latest.version,
        status: latest.status,
        readinessStatus: latest.readinessStatus,
        qaStatus: latest.qaStatus,
        reused: true,
      };
    }

    const resumeQa = runResumeQa({ jobTitle: job.title, company: job.company, content: revision.contentJson });
    const qa = runApplicationPackageQa({
      jobTitle: job.title,
      company: job.company,
      jobPostingId,
      resumeVersionId: resume.id,
      resumeVersionRevisionId: revision.id,
      resumeBelongsToJob: true,
      resumeReady: resume.status === "READY",
      coverLetterRequired,
      coverLetterReady: coverLetter?.status === "READY",
      coverLetterJobId: coverLetter?.jobPostingId ?? null,
      coverLetterHasUnsupportedClaim: Boolean(coverLetter?.activeRevision?.content.includes("[[UNSUPPORTED_CLAIM]]")),
      requiredInputs: mergedInputs,
      alreadyApplied: Boolean(alreadyApplied),
      listingExpired: false,
      stale: false,
    });
    if (!resumeQa.passed) {
      qa.checks.push({ key: "resumeQa", passed: false, message: resumeQa.issues[0] ?? "Resume needs review." });
      if (qa.status === "PASS") qa.status = "FAILED";
    }

    const readiness = calculateApplicationReadiness({
      listingExpired: false,
      alreadyApplied: Boolean(alreadyApplied),
      resumeReady: resume.status === "READY",
      resumeExists: true,
      coverLetterRequired,
      coverLetterReady: coverLetter?.status === "READY",
      requiredInputs: mergedInputs,
      qaStatus: qa.status,
    });

    const nextVersion =
      !options?.forceNewPackage && latest && latest.status !== "APPROVED" && latest.status !== "SUBMITTED"
        ? latest.version
        : (latest?.version ?? 0) + 1;

    const opportunitySnapshot = {
      opportunityScore: analysis.opportunityScore,
      priorityScore: analysis.priorityScore,
      priorityBand: analysis.priorityBand,
      recommendation: analysis.recommendation,
      eligibilityStatus: analysis.eligibilityStatus,
      applicationEffort: analysis.applicationEffort,
      evidenceCoverage: analysis.evidenceCoverage,
      summary: analysis.summary,
      whyYouMatch: analysis.whyYouMatch,
      contextFingerprint: analysis.contextFingerprint,
    };

    const evidenceSnapshot = requirements.map((row) => ({
      id: row.id,
      normalizedName: row.normalizedName,
      importance: row.importance,
      category: row.category,
      sourceExcerpt: row.sourceExcerpt,
      evidence: row.evidenceMatches.slice(0, 3).map((match) => ({
        evidenceLabel: match.evidenceLabel,
        matchStrength: match.matchStrength,
        reasoning: match.reasoning,
        evidenceExcerpt: match.evidenceExcerpt,
      })),
    }));

    const data = {
      userId,
      jobPostingId,
      applicationQueueItemId: options?.queueItemId ?? latest?.applicationQueueItemId ?? null,
      version: nextVersion,
      resumeVersionId: resume.id,
      resumeVersionRevisionId: revision.id,
      coverLetterDraftId,
      coverLetterRevisionId: coverLetter?.activeRevisionId ?? null,
      applicationEmailDraftId,
      status: "READY_FOR_REVIEW" as const,
      readinessStatus: readiness,
      qaStatus: qa.status,
      opportunitySnapshotJson: toPrismaJson(opportunitySnapshot),
      evidenceSnapshotJson: toPrismaJson(evidenceSnapshot),
      gapSnapshotJson: toPrismaJson(analysis.gaps),
      eligibilitySnapshotJson: toPrismaJson(analysis.eligibilityChecks),
      requiredUserInputsJson: toPrismaJson(mergedInputs),
      qaSnapshotJson: toPrismaJson(qa),
      warningsJson: toPrismaJson(analysis.warnings),
      contextFingerprint: fingerprint,
      preparedAt: new Date(),
    };

    const shouldUpdate =
      latest &&
      latest.version === nextVersion &&
      latest.status !== "APPROVED" &&
      latest.status !== "SUBMITTED" &&
      latest.status !== "ARCHIVED";

    const saved = shouldUpdate
      ? await prisma.applicationPackage.update({ where: { id: latest.id }, data })
      : await prisma.applicationPackage.create({ data });

    return {
      packageId: saved.id,
      version: saved.version,
      status: saved.status,
      readinessStatus: saved.readinessStatus,
      qaStatus: saved.qaStatus,
      reused: Boolean(shouldUpdate),
    };
  } finally {
    releasePackageLock(userId, jobPostingId);
  }
}
