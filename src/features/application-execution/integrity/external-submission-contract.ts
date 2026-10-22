import type {
  ConfirmationStrength,
  ExternalSubmissionPhase,
  RecoveryDisposition,
  SubmitAuthorizationState,
} from "@/generated/prisma/client";

export const EXTERNAL_PHASES = [
  "EXECUTION_STARTED",
  "FORM_READY",
  "SUBMIT_BOUNDARY_ACQUIRED",
  "CLICK_ATTEMPT_STARTED",
  "CLICK_DISPATCHED",
  "POST_CLICK_ACTIVITY_OBSERVED",
  "CONFIRMATION_OBSERVED",
  "CONFIRMATION_PERSISTED",
  "LOCAL_FINALIZATION_COMPLETED",
  "PROVIDER_REJECTED",
  "USER_ABORTED",
  "FAILED_BEFORE_CLICK",
] as const satisfies readonly ExternalSubmissionPhase[];

export const RECOVERY_DISPOSITIONS = [
  "SAFE_TO_RETRY",
  "VERIFY_PROVIDER",
  "SUBMIT_UNCERTAIN",
  "CONFIRMED_NEEDS_LOCAL_RECONCILIATION",
  "ALREADY_FINALIZED",
  "MANUAL_REVIEW_REQUIRED",
] as const satisfies readonly RecoveryDisposition[];

export const CONFIRMATION_STRENGTHS = ["NONE", "WEAK", "STRONG", "DEFINITIVE"] as const satisfies readonly ConfirmationStrength[];

export const EXTERNAL_FAULT_POINTS = [
  "AFTER_AUTHORIZATION",
  "AFTER_BOUNDARY",
  "AFTER_CLICK_ATTEMPT_STARTED",
  "AFTER_CLICK_DISPATCH",
  "AFTER_POST_CLICK_ACTIVITY",
  "AFTER_CONFIRMATION_OBSERVED",
  "AFTER_CONFIRMATION_PERSISTED",
  "BEFORE_LOCAL_FINALIZATION",
  "DURING_LOCAL_FINALIZATION",
] as const;

export type ExternalFaultPoint = (typeof EXTERNAL_FAULT_POINTS)[number];

export type ProviderCapability = {
  canDetectFormReady: boolean;
  canDetectClickAttempt: boolean;
  canDetectClickDispatch: boolean;
  canObservePostClickNavigation: boolean;
  canObservePostClickNetwork: boolean;
  canConfirmSubmission: boolean;
  canReturnProviderReference: boolean;
  canVerifyAfterRestart: boolean;
  /** NOT_FOUND is proof of non-submission only when the provider contract says so. */
  notFoundProvesNotSubmitted: boolean;
};

export const LOCAL_QA_CAPABILITY: ProviderCapability = {
  canDetectFormReady: true,
  canDetectClickAttempt: true,
  canDetectClickDispatch: true,
  canObservePostClickNavigation: true,
  canObservePostClickNetwork: true,
  canConfirmSubmission: true,
  canReturnProviderReference: true,
  canVerifyAfterRestart: true,
  notFoundProvesNotSubmitted: false,
};

export const OPAQUE_PROVIDER_CAPABILITY: ProviderCapability = {
  canDetectFormReady: true,
  canDetectClickAttempt: true,
  canDetectClickDispatch: false,
  canObservePostClickNavigation: false,
  canObservePostClickNetwork: false,
  canConfirmSubmission: false,
  canReturnProviderReference: false,
  canVerifyAfterRestart: false,
  notFoundProvesNotSubmitted: false,
};

export type StructuredSubmitEvidence = {
  clickAttempted: boolean;
  clickDispatched: boolean;
  navigationObserved: boolean;
  networkActivityObserved: boolean;
  domTransitionObserved: boolean;
  confirmationObserved: boolean;
  confirmationType: string | null;
  confirmationStrength: ConfirmationStrength;
  providerReference: string | null;
  providerRejected: boolean;
  failureClassification:
    | "CLICK_FAILED_BEFORE_DISPATCH"
    | "SELECTOR_MISSING"
    | "WRONG_SELECTOR"
    | "DUPLICATE_SUBMIT_CONTROLS"
    | "BROWSER_CLOSED"
    | "NETWORK_TIMEOUT"
    | "PROVIDER_REJECTED"
    | null;
  observedText?: string | null;
  urlBefore?: string | null;
  urlAfter?: string | null;
};

export type ConfirmationDecision = {
  trusted: boolean;
  strength: ConfirmationStrength;
  confirmationType: string | null;
  reason: string;
};

export type SubmissionFacts = {
  authorizationState: SubmitAuthorizationState | null;
  boundaryAcquired: boolean;
  clickAttemptStarted: boolean;
  clickDispatched: boolean;
  provenNotDispatched: boolean;
  manuallyResolvedNotSubmitted: boolean;
  confirmationTrusted: boolean;
  locallyFinalized: boolean;
  providerRejected: boolean;
  capability: ProviderCapability;
  verificationResult: "CONFIRMED" | "NOT_FOUND" | "INCONCLUSIVE" | null;
};

const PHASE_NEXT: Record<ExternalSubmissionPhase, readonly ExternalSubmissionPhase[]> = {
  EXECUTION_STARTED: ["FORM_READY", "FAILED_BEFORE_CLICK", "USER_ABORTED"],
  FORM_READY: ["SUBMIT_BOUNDARY_ACQUIRED", "FAILED_BEFORE_CLICK", "USER_ABORTED"],
  SUBMIT_BOUNDARY_ACQUIRED: ["CLICK_ATTEMPT_STARTED", "FAILED_BEFORE_CLICK", "USER_ABORTED"],
  CLICK_ATTEMPT_STARTED: ["CLICK_DISPATCHED", "FAILED_BEFORE_CLICK", "PROVIDER_REJECTED", "CONFIRMATION_OBSERVED"],
  CLICK_DISPATCHED: ["POST_CLICK_ACTIVITY_OBSERVED", "CONFIRMATION_OBSERVED", "PROVIDER_REJECTED"],
  POST_CLICK_ACTIVITY_OBSERVED: ["CONFIRMATION_OBSERVED", "PROVIDER_REJECTED"],
  CONFIRMATION_OBSERVED: ["CONFIRMATION_PERSISTED"],
  CONFIRMATION_PERSISTED: ["LOCAL_FINALIZATION_COMPLETED"],
  LOCAL_FINALIZATION_COMPLETED: [],
  PROVIDER_REJECTED: [],
  USER_ABORTED: [],
  FAILED_BEFORE_CLICK: [],
};

const AUTHORIZATION_NEXT: Record<SubmitAuthorizationState, readonly SubmitAuthorizationState[]> = {
  ISSUED: ["CONSUMED", "CANCELLED", "EXPIRED"],
  CONSUMED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const GENERIC_CONFIRMATION = /thank you|success|submitted/i;
const BLOCKED_EVIDENCE = /password|cookie|token|authorization|secret|localstorage|sessionstorage|ssn|formpayload|resumebody|coverletter/i;

export const FINAL_SUBMIT_SELECTOR = "[data-careeros-final-submit]";
export const PROVIDER_SUCCESS_TYPE = "provider-success-page";
export const PROVIDER_RECORD_TYPE = "provider-application-record";

export function assertPhaseTransition(from: ExternalSubmissionPhase | null, to: ExternalSubmissionPhase): void {
  if (from === null || from === to) return;
  if (!PHASE_NEXT[from].includes(to)) {
    throw new Error(`Illegal external phase transition ${from} -> ${to}`);
  }
}

export function assertAuthorizationTransition(from: SubmitAuthorizationState, to: SubmitAuthorizationState): void {
  if (from === to) return;
  if (!AUTHORIZATION_NEXT[from].includes(to)) {
    throw new Error(`Illegal authorization transition ${from} -> ${to}`);
  }
}

export function assessSubmitControls(matchedSelectors: readonly string[]): "OK" | "SELECTOR_MISSING" | "WRONG_SELECTOR" | "DUPLICATE_SUBMIT_CONTROLS" {
  const finals = matchedSelectors.filter((selector) => selector === FINAL_SUBMIT_SELECTOR);
  if (finals.length > 1) return "DUPLICATE_SUBMIT_CONTROLS";
  if (finals.length === 1) return "OK";
  if (matchedSelectors.length === 0) return "SELECTOR_MISSING";
  return "WRONG_SELECTOR";
}

function realProviderReference(value: string | null | undefined): string | null {
  const reference = value?.trim() ?? "";
  if (reference.length < 4 || GENERIC_CONFIRMATION.test(reference)) return null;
  return reference;
}

export function evaluateProviderConfirmation(
  evidence: StructuredSubmitEvidence,
  capability: ProviderCapability,
): ConfirmationDecision {
  if (evidence.providerRejected || evidence.failureClassification === "PROVIDER_REJECTED") {
    return { trusted: false, strength: "NONE", confirmationType: null, reason: "PROVIDER_REJECTED" };
  }

  const text = evidence.observedText?.trim() ?? "";
  const genericText = text.length > 0 && GENERIC_CONFIRMATION.test(text);
  const reference = realProviderReference(evidence.providerReference);

  if (reference && capability.canReturnProviderReference && evidence.confirmationStrength === "DEFINITIVE") {
    return { trusted: true, strength: "DEFINITIVE", confirmationType: PROVIDER_RECORD_TYPE, reason: "PROVIDER_REFERENCE" };
  }

  if (genericText || evidence.confirmationStrength === "WEAK" || evidence.confirmationStrength === "NONE") {
    return {
      trusted: false,
      strength: genericText || evidence.confirmationStrength === "WEAK" ? "WEAK" : "NONE",
      confirmationType: evidence.confirmationType,
      reason: genericText ? "GENERIC_TEXT" : "WEAK_OR_NONE",
    };
  }

  if (
    evidence.confirmationObserved &&
    evidence.confirmationStrength === "STRONG" &&
    evidence.confirmationType === PROVIDER_SUCCESS_TYPE &&
    capability.canConfirmSubmission
  ) {
    return { trusted: true, strength: "STRONG", confirmationType: PROVIDER_SUCCESS_TYPE, reason: "PROVIDER_SUCCESS_PAGE" };
  }

  return { trusted: false, strength: "WEAK", confirmationType: evidence.confirmationType, reason: "UNTRUSTED" };
}

export function classifyInterruptedSubmission(facts: SubmissionFacts): RecoveryDisposition {
  if (facts.locallyFinalized) return "ALREADY_FINALIZED";
  if (facts.manuallyResolvedNotSubmitted) return "SAFE_TO_RETRY";
  if (facts.confirmationTrusted || facts.verificationResult === "CONFIRMED") {
    return "CONFIRMED_NEEDS_LOCAL_RECONCILIATION";
  }
  if (facts.providerRejected) return "SAFE_TO_RETRY";
  if (facts.provenNotDispatched && !facts.clickDispatched) return "SAFE_TO_RETRY";
  if (!facts.boundaryAcquired && !facts.clickAttemptStarted) return "SAFE_TO_RETRY";
  if (facts.boundaryAcquired && !facts.clickAttemptStarted) return "SAFE_TO_RETRY";

  const clickMayHaveReachedProvider = facts.clickDispatched || (facts.clickAttemptStarted && !facts.provenNotDispatched);
  if (!clickMayHaveReachedProvider) return "SAFE_TO_RETRY";

  if (facts.verificationResult === "NOT_FOUND" && facts.capability.notFoundProvesNotSubmitted) return "SAFE_TO_RETRY";
  if (facts.verificationResult === "INCONCLUSIVE") return "SUBMIT_UNCERTAIN";
  if (facts.verificationResult === "NOT_FOUND") return "MANUAL_REVIEW_REQUIRED";
  if (!facts.clickDispatched && facts.capability.canVerifyAfterRestart) return "VERIFY_PROVIDER";
  if (!facts.clickDispatched) return "MANUAL_REVIEW_REQUIRED";
  if (facts.capability.canVerifyAfterRestart && facts.verificationResult === null) return "VERIFY_PROVIDER";
  return "SUBMIT_UNCERTAIN";
}

export function canRetryDisposition(disposition: RecoveryDisposition): boolean {
  return disposition === "SAFE_TO_RETRY";
}

export function canVerifyDisposition(disposition: RecoveryDisposition, capability: ProviderCapability): boolean {
  return disposition === "VERIFY_PROVIDER" && capability.canVerifyAfterRestart;
}

export function requiresManualReview(disposition: RecoveryDisposition): boolean {
  return disposition === "MANUAL_REVIEW_REQUIRED" || disposition === "SUBMIT_UNCERTAIN" || disposition === "VERIFY_PROVIDER";
}

export function submissionMayHaveReachedProvider(disposition: RecoveryDisposition): boolean {
  return disposition === "SUBMIT_UNCERTAIN" || disposition === "MANUAL_REVIEW_REQUIRED" || disposition === "VERIFY_PROVIDER";
}

export function sanitizeEvidence(metadata: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_EVIDENCE.test(key)) continue;
    if (typeof value === "string" && BLOCKED_EVIDENCE.test(value) && value.length > 80) continue;
    if (value && typeof value === "object") continue;
    next[key] = value;
  }
  return next;
}

export function provenNotDispatched(evidence: StructuredSubmitEvidence): boolean {
  if (evidence.clickDispatched) return false;
  return (
    evidence.failureClassification === "CLICK_FAILED_BEFORE_DISPATCH" ||
    evidence.failureClassification === "SELECTOR_MISSING" ||
    evidence.failureClassification === "WRONG_SELECTOR" ||
    evidence.failureClassification === "DUPLICATE_SUBMIT_CONTROLS"
  );
}
