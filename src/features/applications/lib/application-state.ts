import type { ApplicationStatus } from "@/generated/prisma/client";

import { ACTIVE_APPLICATION_STATUSES, CLOSED_APPLICATION_STATUSES } from "../types";

/**
 * Allowed forward transitions. Real hiring processes skip stages, so APPLIED can
 * jump straight to INTERVIEW or OFFER. Terminal states are not reopenable here.
 */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: ["APPLIED", "WITHDRAWN"],
  APPLIED: ["SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"],
  SCREENING: ["ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"],
  ASSESSMENT: ["INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Preparing application",
  APPLIED: "Applied",
  SCREENING: "Screening",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/** Short label used inside dense list rows and chips. */
export const APPLICATION_STATUS_SHORT_LABELS: Record<ApplicationStatus, string> = {
  ...APPLICATION_STATUS_LABELS,
  DRAFT: "Draft",
};

export function isActiveApplicationStatus(status: ApplicationStatus): boolean {
  return (ACTIVE_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export function isClosedApplicationStatus(status: ApplicationStatus): boolean {
  return (CLOSED_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export function allowedTransitionsFor(status: ApplicationStatus): readonly ApplicationStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedTransitionsFor(from).includes(to);
}

/** Resume links stay editable only while the application has not been submitted. */
export function canChangeResumeLink(status: ApplicationStatus): boolean {
  return status === "DRAFT";
}
