export const EXECUTION_DOMAIN_STATES = [
  "PREPARED",
  "AWAITING_USER_REVIEW",
  "READY_TO_EXECUTE",
  "EXECUTING",
  "FILLING_FORM",
  "READY_AT_SUBMIT_BOUNDARY",
  "SUBMITTING",
  "SUBMITTED_CONFIRMED",
  "SUBMIT_UNCERTAIN",
  "FAILED_BEFORE_SUBMIT",
  "FAILED_AFTER_SUBMIT_ATTEMPT",
  "USER_ABORTED",
  "CANCELLED",
] as const;

export type ExecutionDomainState = (typeof EXECUTION_DOMAIN_STATES)[number];

const LEGAL: Record<ExecutionDomainState, readonly ExecutionDomainState[]> = {
  PREPARED: ["AWAITING_USER_REVIEW", "USER_ABORTED", "CANCELLED", "FAILED_BEFORE_SUBMIT"],
  AWAITING_USER_REVIEW: ["READY_TO_EXECUTE", "USER_ABORTED", "CANCELLED", "FAILED_BEFORE_SUBMIT"],
  READY_TO_EXECUTE: ["EXECUTING", "USER_ABORTED", "CANCELLED", "FAILED_BEFORE_SUBMIT"],
  EXECUTING: ["FILLING_FORM", "FAILED_BEFORE_SUBMIT", "USER_ABORTED", "CANCELLED"],
  FILLING_FORM: ["READY_AT_SUBMIT_BOUNDARY", "FAILED_BEFORE_SUBMIT", "USER_ABORTED", "CANCELLED"],
  READY_AT_SUBMIT_BOUNDARY: ["SUBMITTING", "USER_ABORTED", "CANCELLED", "FAILED_BEFORE_SUBMIT"],
  SUBMITTING: ["SUBMITTED_CONFIRMED", "SUBMIT_UNCERTAIN", "FAILED_AFTER_SUBMIT_ATTEMPT"],
  SUBMITTED_CONFIRMED: [],
  SUBMIT_UNCERTAIN: ["SUBMITTED_CONFIRMED"],
  FAILED_BEFORE_SUBMIT: ["READY_TO_EXECUTE"],
  FAILED_AFTER_SUBMIT_ATTEMPT: [],
  USER_ABORTED: [],
  CANCELLED: [],
};

export function canTransitionDomain(from: ExecutionDomainState, to: ExecutionDomainState): boolean {
  if (from === to) return true;
  return LEGAL[from].includes(to);
}

export function assertDomainTransition(from: ExecutionDomainState, to: ExecutionDomainState): void {
  if (!canTransitionDomain(from, to)) {
    throw new Error(`Illegal execution transition ${from} -> ${to}`);
  }
}

export type ProviderExecutionResult = {
  boundaryReached: boolean;
  submitTriggered: boolean;
  confirmed: boolean;
  confirmationEvidence?: string | null;
  providerReference?: string | null;
  failure?: {
    code: "MISSING_FIELD" | "SELECTOR_CHANGED" | "NAVIGATION_TIMEOUT" | "BROWSER_CRASHED" | "SUBMISSION_REJECTED" | "CONFIRMATION_TIMEOUT" | "FORM_UNAVAILABLE";
    phase: "BEFORE_SUBMIT" | "AFTER_SUBMIT";
  } | null;
};
