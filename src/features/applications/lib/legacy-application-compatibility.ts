import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";

/**
 * Backward compatibility for `jobPosting.applicationStatus`.
 *
 * The `application` model is the canonical source of truth for Milestone 22.
 * Analytics, the Jobs list chip and the settings export still read the legacy
 * string column, so it is mirrored from the current attempt to stop those views
 * disagreeing with the tracker. Nothing in the applications feature reads it back.
 *
 * Only the five strings the existing code already understands are ever written:
 * "saved" | "applied" | "interview" | "offer" | "rejected".
 */
const LEGACY_STATUS_MAP: Record<ApplicationStatus, string | null> = {
  DRAFT: "saved",
  APPLIED: "applied",
  // Legacy has no screening/assessment concept; "applied" is the closest value
  // the existing consumers understand without inventing a new string.
  SCREENING: "applied",
  ASSESSMENT: "applied",
  INTERVIEW: "interview",
  OFFER: "offer",
  // Legacy has no "accepted"; an accepted offer is still an offer state there.
  ACCEPTED: "offer",
  REJECTED: "rejected",
  // Deliberately unmapped: withdrawing is not an employer rejection and legacy
  // has no equivalent, so the legacy field is left untouched.
  WITHDRAWN: null,
};

export function toLegacyApplicationStatus(status: ApplicationStatus): string | null {
  return LEGACY_STATUS_MAP[status];
}

/**
 * Mirrors one application's state onto its source job posting.
 *
 * Runs inside the caller's transaction so the legacy projection can never drift
 * from the application row it was derived from.
 */
export async function syncLegacyJobApplicationFields(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    jobPostingId: string | null;
    status: ApplicationStatus;
    appliedAt: Date | null;
  },
): Promise<void> {
  if (!params.jobPostingId) return;

  const legacyStatus = toLegacyApplicationStatus(params.status);
  if (!legacyStatus) return;

  const job = await tx.jobPosting.findFirst({
    where: { id: params.jobPostingId, userId: params.userId },
    select: { id: true, appliedAt: true },
  });

  if (!job) return;

  await tx.jobPosting.update({
    where: { id: job.id },
    data: {
      applicationStatus: legacyStatus,
      ...(params.appliedAt && !job.appliedAt ? { appliedAt: params.appliedAt } : {}),
    },
  });
}
