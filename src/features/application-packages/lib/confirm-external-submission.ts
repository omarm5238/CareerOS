import { prisma } from "@/server/db/prisma";

import { transitionApplicationStatus } from "@/features/applications/lib/transition-application-status";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

import type { SubmissionOutcome } from "../types";
import { parseWarnings, toPrismaJson } from "./json-parsers";

export function parseSubmissionOutcome(value: unknown): SubmissionOutcome {
  if (value === "SUBMITTED" || value === "NOT_YET" || value === "CLOSED" || value === "DECLINED_TO_APPLY") {
    return value;
  }
  throw new OpportunityAccessError("INVALID_INPUT", "Choose a supported submission outcome.");
}

export async function confirmExternalSubmission(
  userId: string,
  packageId: string,
  outcomeRaw: unknown,
) {
  const outcome = parseSubmissionOutcome(outcomeRaw);
  const row = await prisma.applicationPackage.findFirst({
    where: { id: packageId, userId },
    include: { application: { select: { id: true, status: true, appliedAt: true } } },
  });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");

  if (outcome === "SUBMITTED") {
    if (row.status !== "SUBMISSION_STARTED" && row.status !== "SUBMITTED") {
      throw new OpportunityAccessError("CONFLICT", "Open the external application before confirming submission.");
    }
    if (row.status === "SUBMITTED" && row.application?.status === "APPLIED") {
      return {
        outcome,
        packageStatus: row.status,
        applicationStatus: row.application.status,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        appliedAt: row.application.appliedAt?.toISOString() ?? null,
      };
    }
    if (!row.applicationId) {
      throw new OpportunityAccessError("CONFLICT", "No application is linked to this package.");
    }
    const transitioned = await transitionApplicationStatus({
      userId,
      applicationId: row.applicationId,
      toStatus: "APPLIED",
    });
    const updated = await prisma.applicationPackage.update({
      where: { id: row.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    return {
      outcome,
      packageStatus: updated.status,
      applicationStatus: transitioned.status,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      appliedAt: transitioned.appliedAt,
    };
  }

  if (outcome === "NOT_YET") {
    return {
      outcome,
      packageStatus: row.status,
      applicationStatus: row.application?.status ?? null,
      submittedAt: null,
      appliedAt: null,
    };
  }

  const warnings = parseWarnings(row.warningsJson);
  warnings.push({
    code: outcome === "CLOSED" ? "user_confirmed_closed" : "user_declined",
    message:
      outcome === "CLOSED"
        ? "The user confirmed the external listing was closed or unavailable. CareerOS did not verify the provider."
        : "The user decided not to apply. CareerOS did not submit an application.",
  });

  const updated = await prisma.applicationPackage.update({
    where: { id: row.id },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
      readinessStatus: outcome === "CLOSED" ? "BLOCKED" : row.readinessStatus,
      warningsJson: toPrismaJson(warnings),
    },
  });

  return {
    outcome,
    packageStatus: updated.status,
    applicationStatus: row.application?.status ?? null,
    submittedAt: null,
    appliedAt: null,
  };
}
