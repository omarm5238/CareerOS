import { prisma } from "@/server/db/prisma";

import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

import { getOpportunityAnalysisForUser } from "@/features/jobs/opportunities/lib/analyze-job-opportunity";

import { buildApplicationPackageFingerprint } from "./application-package-fingerprint";
import { calculateApplicationReadiness } from "./calculate-application-readiness";
import { parseQaSnapshot, parseRequiredUserInputs, toPrismaJson } from "./json-parsers";
import { runApplicationPackageQa } from "./run-application-package-qa";
import type { RequiredUserInputKey } from "../types";

const KEYS: RequiredUserInputKey[] = [
  "WORK_AUTHORIZATION",
  "VISA_SPONSORSHIP",
  "SALARY_EXPECTATION",
  "RELOCATION",
  "START_DATE",
  "SECURITY_CLEARANCE",
  "OTHER",
];

export async function updateRequiredUserInput(
  userId: string,
  packageId: string,
  body: unknown,
) {
  const record = (body ?? {}) as Record<string, unknown>;
  const key = record.key;
  if (typeof key !== "string" || !KEYS.includes(key as RequiredUserInputKey)) {
    throw new OpportunityAccessError("INVALID_INPUT", "Unknown required user input.");
  }
  if (record.confirmed !== true) {
    throw new OpportunityAccessError("INVALID_INPUT", "Legal and sensitive answers require explicit confirmation.");
  }
  const value = typeof record.value === "string" ? record.value.trim() : "";
  if (!value || value.length > 200) {
    throw new OpportunityAccessError("INVALID_INPUT", "Enter a short explicit answer.");
  }

  const row = await prisma.applicationPackage.findFirst({ where: { id: packageId, userId } });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");
  if (row.status === "APPROVED" || row.status === "SUBMITTED" || row.status === "SUBMISSION_STARTED") {
    throw new OpportunityAccessError("CONFLICT", "Approved package inputs cannot be rewritten.");
  }

  const inputs = parseRequiredUserInputs(row.requiredUserInputsJson);
  const target = inputs.find((item) => item.key === key);
  if (!target) throw new OpportunityAccessError("INVALID_INPUT", "That input is not required for this package.");

  target.value = value;
  target.valueSource = "user";
  target.resolved = true;
  target.resolvedAt = new Date().toISOString();

  const resume = row.resumeVersionId
    ? await prisma.resumeVersion.findFirst({ where: { id: row.resumeVersionId, userId }, select: { status: true, targetJobId: true } })
    : null;
  const cover = row.coverLetterDraftId
    ? await prisma.communicationDraft.findFirst({ where: { id: row.coverLetterDraftId, userId }, select: { status: true } })
    : null;
  const alreadyApplied = await prisma.application.findFirst({
    where: {
      userId,
      jobPostingId: row.jobPostingId,
      status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
    },
    select: { id: true },
  });

  const previousQa = parseQaSnapshot(row.qaSnapshotJson);
  const qa = runApplicationPackageQa({
    jobTitle: "present",
    company: "present",
    jobPostingId: row.jobPostingId,
    resumeVersionId: row.resumeVersionId,
    resumeVersionRevisionId: row.resumeVersionRevisionId,
    resumeBelongsToJob: resume?.targetJobId === row.jobPostingId,
    resumeReady: resume?.status === "READY",
    coverLetterRequired: Boolean(row.coverLetterDraftId),
    coverLetterReady: cover?.status === "READY",
    coverLetterJobId: row.jobPostingId,
    coverLetterHasUnsupportedClaim: false,
    requiredInputs: inputs,
    alreadyApplied: Boolean(alreadyApplied),
    listingExpired: false,
    stale: false,
  });
  qa.repairAttempted = previousQa.repairAttempted;

  const analysis = row.jobPostingId ? await getOpportunityAnalysisForUser(userId, row.jobPostingId) : null;
  const liveRequirements = row.jobPostingId
    ? await prisma.jobRequirement.findMany({
        where: { userId, jobPostingId: row.jobPostingId },
        select: { id: true },
      })
    : [];
  const coverRevision = row.coverLetterDraftId
    ? await prisma.communicationDraft.findFirst({
        where: { id: row.coverLetterDraftId, userId },
        select: { activeRevisionId: true, activeRevision: { select: { content: true } } },
      })
    : null;
  const contextFingerprint = buildApplicationPackageFingerprint({
    jobFingerprint: analysis?.contextFingerprint ?? row.contextFingerprint,
    analysisFingerprint: analysis?.contextFingerprint ?? row.contextFingerprint,
    requirementSignal: liveRequirements.map((item) => item.id).sort().join(","),
    resumeVersionRevisionId: row.resumeVersionRevisionId,
    coverLetterRevisionId: coverRevision?.activeRevisionId ?? null,
    coverLetterContentSignal: coverRevision?.activeRevision?.content.slice(0, 400) ?? null,
    emailRevisionId: null,
    requiredInputs: inputs.map((item) => `${item.key}:${item.resolved}:${item.value ?? ""}`).join(","),
  });

  const readiness = calculateApplicationReadiness({
    listingExpired: false,
    alreadyApplied: Boolean(alreadyApplied),
    resumeReady: resume?.status === "READY",
    resumeExists: Boolean(row.resumeVersionId),
    coverLetterRequired: Boolean(row.coverLetterDraftId),
    coverLetterReady: cover?.status === "READY",
    requiredInputs: inputs,
    qaStatus: qa.status,
  });

  await prisma.applicationPackage.update({
    where: { id: row.id },
    data: {
      requiredUserInputsJson: toPrismaJson(inputs),
      qaSnapshotJson: toPrismaJson(qa),
      qaStatus: qa.status,
      readinessStatus: readiness,
      contextFingerprint,
    },
  });

  return { packageId: row.id, readinessStatus: readiness, qaStatus: qa.status };
}
