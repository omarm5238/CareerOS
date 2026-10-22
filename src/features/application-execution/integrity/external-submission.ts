import { createHash, randomBytes } from "node:crypto";

import type { ApplicationExecutionEventType, Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";

import { evaluateApplicationReadiness } from "@/features/application-packages/readiness/evaluate-application-readiness";
import { prisma } from "@/server/db/prisma";

import { recordExecutionEvent } from "../sessions/execution-event";
import { toPrismaJson } from "../lib/json-parsers";
import {
  finalizeConfirmedSubmission,
  persistTrustedConfirmation,
} from "./finalize-confirmed-submission";
import {
  assertAuthorizationTransition,
  assertPhaseTransition,
  canRetryDisposition,
  canVerifyDisposition,
  classifyInterruptedSubmission,
  evaluateProviderConfirmation,
  LOCAL_QA_CAPABILITY,
  provenNotDispatched,
  requiresManualReview,
  sanitizeEvidence,
  submissionMayHaveReachedProvider,
  type ExternalFaultPoint,
  type ProviderCapability,
  type StructuredSubmitEvidence,
  type SubmissionFacts,
} from "./external-submission-contract";

const AUTHORIZATION_TTL_MS = 15 * 60 * 1000;

export class ExternalSubmissionFault extends Error {
  constructor(readonly point: ExternalFaultPoint) {
    super(point);
    this.name = "ExternalSubmissionFault";
  }
}

export class ExternalSubmissionRejected extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "ExternalSubmissionRejected";
  }
}

export class ClickFailedBeforeDispatch extends Error {
  constructor() {
    super("CLICK_FAILED_BEFORE_DISPATCH");
    this.name = "ClickFailedBeforeDispatch";
  }
}

type AttemptRow = Prisma.applicationSubmissionAttemptGetPayload<{
  include: { authorization: true; executionSession: true };
}>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function evidenceOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function hostOf(destination: string | null): string {
  if (!destination) return "";
  try {
    return new URL(destination).host.toLowerCase();
  } catch {
    return "";
  }
}

function capabilityOf(evidence: Record<string, unknown>, fallback: ProviderCapability): ProviderCapability {
  const stored = evidence.capability;
  if (!stored || typeof stored !== "object") return fallback;
  return { ...fallback, ...(stored as ProviderCapability) };
}

async function loadOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow | null> {
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({ where: { id: attemptId, userId } });
  if (!attempt) return null;
  const [authorization, executionSession] = await Promise.all([
    prisma.applicationSubmitAuthorization.findUnique({ where: { attemptId: attempt.id } }),
    prisma.applicationExecutionSession.findUnique({ where: { id: attempt.executionSessionId } }),
  ]);
  if (!executionSession) return null;
  return { ...attempt, authorization, executionSession };
}

async function project(
  attempt: { id: string; userId: string; executionSessionId: string; externalPhase: AttemptRow["externalPhase"] },
  phase: AttemptRow["externalPhase"],
  eventType: ApplicationExecutionEventType,
  message: string,
  metadata: Record<string, unknown>,
  data: Prisma.applicationSubmissionAttemptUpdateInput,
  sessionData?: Prisma.applicationExecutionSessionUpdateInput,
): Promise<void> {
  if (!phase) throw new Error("External phase is required.");
  assertPhaseTransition(attempt.externalPhase, phase);
  await prisma.$transaction(async (tx) => {
    await tx.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { ...data, externalPhase: phase },
    });
    if (sessionData) {
      await tx.applicationExecutionSession.update({
        where: { id: attempt.executionSessionId },
        data: sessionData,
      });
    }
    await recordExecutionEvent(tx, {
      userId: attempt.userId,
      executionSessionId: attempt.executionSessionId,
      type: eventType,
      message,
      metadata: sanitizeEvidence(metadata),
    });
  });
  attempt.externalPhase = phase;
}

export async function issueSubmitAuthorization(
  userId: string,
  input: { applicationId: string; packageId: string; attemptId: string },
): Promise<{ ok: true; authorizationId: string; token: string; expiresAt: Date } | { ok: false; reason: string }> {
  const attempt = await loadOwnedAttempt(userId, input.attemptId);
  if (!attempt || attempt.applicationId !== input.applicationId || attempt.applicationPackageId !== input.packageId) {
    return { ok: false, reason: "OWNERSHIP_MISMATCH" };
  }
  const readiness = await evaluateApplicationReadiness(userId, input.packageId);
  if (readiness.status !== "READY" || readiness.blockers.length > 0) {
    return { ok: false, reason: "PACKAGE_NOT_READY" };
  }
  const siblings = await prisma.applicationSubmissionAttempt.findMany({
    where: { applicationId: attempt.applicationId, userId, id: { not: attempt.id } },
    select: { clickAttemptStartedAt: true, clickDispatchedAt: true, recoveryDisposition: true },
  });
  const dangerous = siblings.some((sibling) => {
    const reached = Boolean(sibling.clickAttemptStartedAt || sibling.clickDispatchedAt);
    if (!reached) return false;
    return sibling.recoveryDisposition !== "SAFE_TO_RETRY" && sibling.recoveryDisposition !== "ALREADY_FINALIZED";
  });
  if (dangerous) return { ok: false, reason: "UNRESOLVED_SUBMISSION" };
  if (attempt.authorization) return { ok: false, reason: "AUTHORIZATION_EXISTS" };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTHORIZATION_TTL_MS);
  const host = hostOf(attempt.destinationUrl);
  if (!host) return { ok: false, reason: "TARGET_UNAVAILABLE" };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const authorization = await tx.applicationSubmitAuthorization.create({
        data: {
          userId,
          applicationId: attempt.applicationId,
          packageId: attempt.applicationPackageId,
          attemptId: attempt.id,
          provider: attempt.executionSession.provider,
          targetHost: host,
          targetJobId: attempt.executionSession.jobPostingId,
          authorizationHash: hashToken(token),
          state: "ISSUED",
          expiresAt,
        },
      });
      await tx.applicationSubmissionAttempt.update({
        where: { id: attempt.id },
        data: { submitAuthorizationId: authorization.id, externalPhase: attempt.externalPhase ?? "EXECUTION_STARTED" },
      });
      await recordExecutionEvent(tx, {
        userId,
        executionSessionId: attempt.executionSessionId,
        type: "SUBMIT_AUTHORIZATION_ISSUED",
        message: "One-shot submit authorization issued.",
        metadata: sanitizeEvidence({
          provider: attempt.executionSession.provider,
          targetHost: host,
          targetJobId: attempt.executionSession.jobPostingId,
          authorizationId: authorization.id,
        }),
      });
      return authorization;
    });
    return { ok: true, authorizationId: created.id, token, expiresAt };
  } catch (error) {
    if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "AUTHORIZATION_CONFLICT" };
    }
    throw error;
  }
}

export async function consumeSubmitAuthorization(input: {
  authorizationId: string;
  token: string;
  userId: string;
  applicationId: string;
  packageId: string;
  attemptId: string;
  provider: string;
  targetHost: string;
  targetJobId: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const current = await prisma.applicationSubmitAuthorization.findUnique({ where: { id: input.authorizationId } });
  if (!current) return { ok: false, reason: "AUTHORIZATION_MISSING" };
  if (current.authorizationHash !== hashToken(input.token)) return { ok: false, reason: "AUTHORIZATION_MISMATCH" };
  if (current.userId !== input.userId) return { ok: false, reason: "CROSS_USER" };
  if (
    current.applicationId !== input.applicationId ||
    current.packageId !== input.packageId ||
    current.attemptId !== input.attemptId ||
    current.provider !== input.provider ||
    current.targetHost !== input.targetHost ||
    (current.targetJobId ?? null) !== input.targetJobId
  ) {
    return { ok: false, reason: "BINDING_MISMATCH" };
  }
  if (current.expiresAt.getTime() <= Date.now()) {
    if (current.state === "ISSUED") {
      assertAuthorizationTransition("ISSUED", "EXPIRED");
      await prisma.applicationSubmitAuthorization.updateMany({
        where: { id: current.id, state: "ISSUED" },
        data: { state: "EXPIRED" },
      });
    }
    return { ok: false, reason: "AUTHORIZATION_EXPIRED" };
  }
  if (current.state !== "ISSUED") return { ok: false, reason: `AUTHORIZATION_${current.state}` };
  assertAuthorizationTransition("ISSUED", "CONSUMED");
  const consumed = await prisma.applicationSubmitAuthorization.updateMany({
    where: {
      id: current.id,
      state: "ISSUED",
      userId: input.userId,
      applicationId: input.applicationId,
      packageId: input.packageId,
      attemptId: input.attemptId,
      provider: input.provider as AttemptRow["executionSession"]["provider"],
      targetHost: input.targetHost,
      targetJobId: input.targetJobId,
      expiresAt: { gt: new Date() },
    },
    data: { state: "CONSUMED", consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: "AUTHORIZATION_NOT_USABLE" };
  return { ok: true };
}

export async function cancelSubmitAuthorization(userId: string, authorizationId: string): Promise<boolean> {
  const current = await prisma.applicationSubmitAuthorization.findFirst({ where: { id: authorizationId, userId } });
  if (!current || current.state !== "ISSUED") return false;
  assertAuthorizationTransition("ISSUED", "CANCELLED");
  const cancelled = await prisma.applicationSubmitAuthorization.updateMany({
    where: { id: current.id, userId, state: "ISSUED" },
    data: { state: "CANCELLED", cancelledAt: new Date() },
  });
  return cancelled.count === 1;
}

export function buildSubmissionFacts(input: {
  attempt: AttemptRow;
  applicationStatus: string;
  submittedAttemptId: string | null;
  capability: ProviderCapability;
  verificationResult: SubmissionFacts["verificationResult"];
}): SubmissionFacts {
  const evidence = evidenceOf(input.attempt.verificationEvidenceJson);
  return {
    authorizationState: input.attempt.authorization?.state ?? null,
    boundaryAcquired: Boolean(input.attempt.submitBoundaryCrossedAt),
    clickAttemptStarted: Boolean(input.attempt.clickAttemptStartedAt),
    clickDispatched: Boolean(input.attempt.clickDispatchedAt),
    provenNotDispatched: evidence.provenNotDispatched === true,
    manuallyResolvedNotSubmitted: evidence.manualResolution === "CONFIRMED_NOT_SUBMITTED",
    confirmationTrusted:
      evidence.trustedConfirmation === true ||
      Boolean(input.attempt.confirmationPersistedAt) ||
      (Boolean(input.attempt.confirmationObservedAt) &&
        (input.attempt.confirmationStrength === "STRONG" || input.attempt.confirmationStrength === "DEFINITIVE")),
    locallyFinalized: input.applicationStatus === "APPLIED" && input.submittedAttemptId === input.attempt.id,
    providerRejected: input.attempt.externalPhase === "PROVIDER_REJECTED",
    capability: capabilityOf(evidence, input.capability),
    verificationResult: input.verificationResult,
  };
}

export async function classifyPersistedSubmission(
  userId: string,
  attemptId: string,
  capability: ProviderCapability = LOCAL_QA_CAPABILITY,
  options: { persist?: boolean } = {},
): Promise<ReturnType<typeof classifyInterruptedSubmission>> {
  const attempt = await loadOwnedAttempt(userId, attemptId);
  if (!attempt) throw new ExternalSubmissionRejected("OWNERSHIP_MISMATCH");
  const application = await prisma.application.findFirst({
    where: { id: attempt.applicationId, userId },
    select: { status: true, submittedExecutionAttemptId: true },
  });
  const evidence = evidenceOf(attempt.verificationEvidenceJson);
  const verification = evidence.verificationResult;
  const facts = buildSubmissionFacts({
    attempt,
    applicationStatus: application?.status ?? "DRAFT",
    submittedAttemptId: application?.submittedExecutionAttemptId ?? null,
    capability,
    verificationResult:
      verification === "CONFIRMED" || verification === "NOT_FOUND" || verification === "INCONCLUSIVE" ? verification : null,
  });
  const disposition = classifyInterruptedSubmission(facts);
  if (options.persist !== false) {
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { recoveryDisposition: disposition },
    });
  }
  return disposition;
}

async function rememberCapability(attempt: AttemptRow, capability: ProviderCapability, versions: {
  providerAdapterVersion: string;
  selectorStrategyVersion: string;
  confirmationStrategyVersion: string;
}): Promise<void> {
  const evidence = evidenceOf(attempt.verificationEvidenceJson);
  evidence.capability = capability;
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      verificationEvidenceJson: toPrismaJson(evidence),
      providerAdapterVersion: attempt.providerAdapterVersion ?? versions.providerAdapterVersion,
      selectorStrategyVersion: attempt.selectorStrategyVersion ?? versions.selectorStrategyVersion,
      confirmationStrategyVersion: attempt.confirmationStrategyVersion ?? versions.confirmationStrategyVersion,
    },
  });
  attempt.providerAdapterVersion = attempt.providerAdapterVersion ?? versions.providerAdapterVersion;
  attempt.selectorStrategyVersion = attempt.selectorStrategyVersion ?? versions.selectorStrategyVersion;
  attempt.confirmationStrategyVersion = attempt.confirmationStrategyVersion ?? versions.confirmationStrategyVersion;
}

export async function executeExternalSubmission(input: {
  userId: string;
  attemptId: string;
  authorizationId: string;
  token: string;
  provider: () => Promise<StructuredSubmitEvidence>;
  capability?: ProviderCapability;
  versions?: {
    providerAdapterVersion: string;
    selectorStrategyVersion: string;
    confirmationStrategyVersion: string;
  };
  fault?: ExternalFaultPoint;
}): Promise<{ disposition: ReturnType<typeof classifyInterruptedSubmission>; providerCalls: number }> {
  const capability = input.capability ?? LOCAL_QA_CAPABILITY;
  const versions = input.versions ?? {
    providerAdapterVersion: "local-qa-adapter-v1",
    selectorStrategyVersion: "local-submit-selector-v1",
    confirmationStrategyVersion: "provider-specific-confirmation-v1",
  };
  const attempt = await loadOwnedAttempt(input.userId, input.attemptId);
  if (!attempt) throw new ExternalSubmissionRejected("OWNERSHIP_MISMATCH");
  if (input.fault === "AFTER_AUTHORIZATION") throw new ExternalSubmissionFault("AFTER_AUTHORIZATION");
  const authorization = attempt.authorization;
  if (!authorization || authorization.id !== input.authorizationId) throw new ExternalSubmissionRejected("AUTHORIZATION_MISSING");
  if (authorization.authorizationHash !== hashToken(input.token)) throw new ExternalSubmissionRejected("AUTHORIZATION_MISMATCH");
  if (authorization.state === "CONSUMED") throw new ExternalSubmissionRejected("AUTHORIZATION_CONSUMED");
  if (authorization.state === "CANCELLED") throw new ExternalSubmissionRejected("AUTHORIZATION_CANCELLED");
  if (authorization.state === "EXPIRED" || authorization.expiresAt.getTime() <= Date.now()) {
    throw new ExternalSubmissionRejected("AUTHORIZATION_EXPIRED");
  }

  await rememberCapability(attempt, capability, versions);
  if (attempt.externalPhase === null || attempt.externalPhase === "EXECUTION_STARTED") {
    await project(
      attempt,
      "FORM_READY",
      "FORM_INSPECTED",
      "Provider form is ready. The final submit control has not been used.",
      { provider: attempt.executionSession.provider },
      {},
    );
  }
  const now = new Date();
  await project(
    attempt,
    "SUBMIT_BOUNDARY_ACQUIRED",
    "SUBMIT_BOUNDARY_ACQUIRED",
    "Submit boundary acquired. No provider click has been performed.",
    { provider: attempt.executionSession.provider, targetHost: hostOf(attempt.destinationUrl) },
    { submitBoundaryCrossedAt: attempt.submitBoundaryCrossedAt ?? now, destinationUrl: attempt.destinationUrl },
  );
  if (input.fault === "AFTER_BOUNDARY") throw new ExternalSubmissionFault("AFTER_BOUNDARY");

  assertPhaseTransition(attempt.externalPhase, "CLICK_ATTEMPT_STARTED");
  const host = hostOf(attempt.destinationUrl);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.applicationSubmitAuthorization.updateMany({
      where: {
        id: input.authorizationId,
        authorizationHash: hashToken(input.token),
        userId: input.userId,
        applicationId: attempt.applicationId,
        packageId: attempt.applicationPackageId,
        attemptId: attempt.id,
        provider: attempt.executionSession.provider,
        targetHost: host,
        targetJobId: attempt.executionSession.jobPostingId,
        state: "ISSUED",
        expiresAt: { gt: new Date() },
      },
      data: { state: "CONSUMED", consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ExternalSubmissionRejected("AUTHORIZATION_NOT_USABLE");
    await tx.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { externalPhase: "CLICK_ATTEMPT_STARTED", clickAttemptStartedAt: new Date(), status: "SUBMITTING" },
    });
    await tx.applicationExecutionSession.update({
      where: { id: attempt.executionSessionId },
      data: { status: "SUBMITTING" },
    });
    await recordExecutionEvent(tx, {
      userId: attempt.userId,
      executionSessionId: attempt.executionSessionId,
      type: "CLICK_ATTEMPT_STARTED",
      message: "Final submit click may now be dispatched. Automatic resubmission is closed.",
      metadata: sanitizeEvidence({ provider: attempt.executionSession.provider }),
    });
  });
  attempt.externalPhase = "CLICK_ATTEMPT_STARTED";
  if (input.fault === "AFTER_CLICK_ATTEMPT_STARTED") throw new ExternalSubmissionFault("AFTER_CLICK_ATTEMPT_STARTED");

  let evidence: StructuredSubmitEvidence;
  let providerCalls = 0;
  try {
    evidence = await input.provider();
    providerCalls += 1;
  } catch (error) {
    if (error instanceof ClickFailedBeforeDispatch) {
      await markNotDispatched(attempt, "CLICK_FAILED_BEFORE_DISPATCH");
      return { disposition: await classifyPersistedSubmission(input.userId, attempt.id, capability), providerCalls };
    }
    await markDispatchUnknown(attempt, error instanceof Error ? error.message : "provider interrupted");
    throw error;
  }

  if (provenNotDispatched(evidence)) {
    await markNotDispatched(attempt, evidence.failureClassification ?? "CLICK_FAILED_BEFORE_DISPATCH");
    return { disposition: await classifyPersistedSubmission(input.userId, attempt.id, capability), providerCalls };
  }
  if (evidence.providerRejected) {
    await project(
      attempt,
      "PROVIDER_REJECTED",
      "SUBMIT_RESPONSE",
      "Provider rejected the application.",
      { provider: attempt.executionSession.provider },
      { status: "FAILED", failureCode: "SUBMISSION_REJECTED", failureMessage: "Provider rejected the application.", recoveryDisposition: "SAFE_TO_RETRY" },
      { status: "FAILED", failureCode: "SUBMISSION_REJECTED" },
    );
    return { disposition: "SAFE_TO_RETRY", providerCalls };
  }
  if (!evidence.clickDispatched) {
    await markDispatchUnknown(attempt, "Click dispatch was not observed.");
    return { disposition: await classifyPersistedSubmission(input.userId, attempt.id, capability), providerCalls };
  }

  await project(
    attempt,
    "CLICK_DISPATCHED",
    "CLICK_DISPATCHED",
    "Browser submit action was dispatched. This is not provider acceptance.",
    { provider: attempt.executionSession.provider, urlBefore: evidence.urlBefore ?? null },
    { clickDispatchedAt: new Date() },
  );
  if (input.fault === "AFTER_CLICK_DISPATCH") throw new ExternalSubmissionFault("AFTER_CLICK_DISPATCH");
  let observedPhase: "CLICK_DISPATCHED" | "POST_CLICK_ACTIVITY_OBSERVED" = "CLICK_DISPATCHED";

  if (evidence.navigationObserved || evidence.networkActivityObserved || evidence.domTransitionObserved) {
    const eventType = evidence.navigationObserved
      ? "POST_CLICK_NAVIGATION_OBSERVED"
      : evidence.networkActivityObserved
        ? "POST_CLICK_NETWORK_OBSERVED"
        : "POST_CLICK_DOM_OBSERVED";
    await project(
      attempt,
      "POST_CLICK_ACTIVITY_OBSERVED",
      eventType,
      "Post-click provider activity was observed. This is not confirmation.",
      {
        provider: attempt.executionSession.provider,
        urlAfter: evidence.urlAfter ?? null,
        navigationObserved: evidence.navigationObserved,
        networkActivityObserved: evidence.networkActivityObserved,
        domTransitionObserved: evidence.domTransitionObserved,
      },
      { postClickActivityObservedAt: new Date() },
    );
    observedPhase = "POST_CLICK_ACTIVITY_OBSERVED";
    if (input.fault === "AFTER_POST_CLICK_ACTIVITY") throw new ExternalSubmissionFault("AFTER_POST_CLICK_ACTIVITY");
  }

  const decision = evaluateProviderConfirmation(evidence, capability);
  if (!decision.trusted) {
    await project(
      attempt,
      observedPhase,
      "CONFIRMATION_EVIDENCE_REJECTED",
      "Observed confirmation evidence is not trusted.",
      { provider: attempt.executionSession.provider, evidenceStrength: decision.strength, reason: decision.reason },
      {
        confirmationStrength: decision.strength,
        status: "UNCERTAIN",
        failureCode: "SUBMISSION_UNCERTAIN",
        failureMessage: "Provider confirmation was not trusted.",
      },
      { status: "INTERRUPTED", failureCode: "SUBMISSION_UNCERTAIN" },
    );
    return { disposition: await classifyPersistedSubmission(input.userId, attempt.id, capability), providerCalls };
  }

  await project(
    attempt,
    "CONFIRMATION_OBSERVED",
    "CONFIRMATION_EVIDENCE_OBSERVED",
    "Trusted provider confirmation was observed.",
    {
      provider: attempt.executionSession.provider,
      evidenceStrength: decision.strength,
      confirmationType: decision.confirmationType,
      providerReference: decision.strength === "DEFINITIVE" ? evidence.providerReference : null,
    },
    { confirmationObservedAt: new Date(), confirmationStrength: decision.strength, confirmationType: decision.confirmationType },
  );
  if (input.fault === "AFTER_CONFIRMATION_OBSERVED") throw new ExternalSubmissionFault("AFTER_CONFIRMATION_OBSERVED");

  const persisted = await persistTrustedConfirmation(input.userId, attempt.id, {
    confirmationType: decision.confirmationType ?? "provider-confirmation",
    confirmationReference: decision.strength === "DEFINITIVE" ? evidence.providerReference : null,
    confirmationEvidence: decision.reason,
  });
  if (!persisted) throw new ExternalSubmissionRejected("CONFIRMATION_NOT_PERSISTED");
  await project(
    attempt,
    "CONFIRMATION_PERSISTED",
    "CONFIRMATION_PERSISTED",
    "Trusted confirmation was durably persisted.",
    { provider: attempt.executionSession.provider, evidenceStrength: decision.strength },
    { confirmationPersistedAt: new Date() },
  );
  if (input.fault === "AFTER_CONFIRMATION_PERSISTED" || input.fault === "BEFORE_LOCAL_FINALIZATION") {
    throw new ExternalSubmissionFault(input.fault);
  }

  const finalized = await finalizeConfirmedSubmission(
    {
      userId: input.userId,
      submissionAttemptId: attempt.id,
    },
    { faultPoint: input.fault === "DURING_LOCAL_FINALIZATION" ? "AFTER_APPLICATION" : undefined },
  );
  if (finalized !== "FINALIZED" && finalized !== "ALREADY_FINALIZED") {
    return { disposition: "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", providerCalls };
  }
  await project(
    attempt,
    "LOCAL_FINALIZATION_COMPLETED",
    "LOCAL_RECONCILIATION_COMPLETED",
    "Local application finalization completed.",
    { provider: attempt.executionSession.provider },
    { recoveryDisposition: "ALREADY_FINALIZED" },
  );
  return { disposition: "ALREADY_FINALIZED", providerCalls };
}

async function markNotDispatched(attempt: AttemptRow, classification: string): Promise<void> {
  const evidence = evidenceOf(attempt.verificationEvidenceJson);
  evidence.provenNotDispatched = true;
  evidence.failureClassification = classification;
  await project(
    attempt,
    "FAILED_BEFORE_CLICK",
    "SESSION_FAILED",
    "The submit action failed before dispatch.",
    { failureClassification: classification },
    {
      status: "FAILED",
      failureCode: "SUBMISSION_REJECTED",
      failureMessage: classification,
      verificationEvidenceJson: toPrismaJson(evidence),
      recoveryDisposition: "SAFE_TO_RETRY",
    },
    { status: "FAILED" },
  );
}

async function markDispatchUnknown(attempt: AttemptRow, message: string): Promise<void> {
  await project(
    attempt,
    "CLICK_ATTEMPT_STARTED",
    "SUBMISSION_MARKED_UNCERTAIN",
    "Click dispatch is unknown. CareerOS will not submit again automatically.",
    { reason: message },
    {
      status: "UNCERTAIN",
      failureCode: "SUBMISSION_UNCERTAIN",
      failureMessage: message,
    },
    { status: "INTERRUPTED", failureCode: "SUBMISSION_UNCERTAIN" },
  );
}

export async function verifyExternalSubmission(
  userId: string,
  attemptId: string,
  verifier: () => Promise<"CONFIRMED" | "NOT_FOUND" | "INCONCLUSIVE">,
  capability: ProviderCapability = LOCAL_QA_CAPABILITY,
): Promise<ReturnType<typeof classifyInterruptedSubmission>> {
  const attempt = await loadOwnedAttempt(userId, attemptId);
  if (!attempt) throw new ExternalSubmissionRejected("OWNERSHIP_MISMATCH");
  const evidence = evidenceOf(attempt.verificationEvidenceJson);
  const stored = capabilityOf(evidence, capability);
  const disposition = await classifyPersistedSubmission(userId, attemptId, stored);
  if (disposition !== "VERIFY_PROVIDER" || !stored.canVerifyAfterRestart) {
    throw new ExternalSubmissionRejected("VERIFICATION_UNSUPPORTED");
  }
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "PROVIDER_VERIFICATION_STARTED",
    message: "Read-only provider verification started.",
    metadata: { provider: attempt.executionSession.provider },
  });
  const result = await verifier();
  const eventType =
    result === "CONFIRMED"
      ? "PROVIDER_VERIFICATION_CONFIRMED"
      : result === "NOT_FOUND"
        ? "PROVIDER_VERIFICATION_NOT_FOUND"
        : "PROVIDER_VERIFICATION_INCONCLUSIVE";
  evidence.verificationResult = result;
  if (result === "CONFIRMED") evidence.trustedConfirmation = true;
  await prisma.$transaction(async (tx) => {
    await tx.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: {
        lastProviderVerificationAt: new Date(),
        verificationEvidenceJson: toPrismaJson(evidence),
        confirmationStrength: result === "CONFIRMED" ? "DEFINITIVE" : attempt.confirmationStrength,
        confirmationType: result === "CONFIRMED" ? attempt.confirmationType ?? "provider-application-record" : attempt.confirmationType,
      },
    });
    await recordExecutionEvent(tx, {
      userId,
      executionSessionId: attempt.executionSessionId,
      type: eventType,
      message: `Provider verification result: ${result}.`,
      metadata: sanitizeEvidence({ provider: attempt.executionSession.provider, verificationResult: result }),
    });
  });
  if (result === "CONFIRMED") {
    await persistTrustedConfirmation(userId, attempt.id, {
      confirmationType: "provider-application-record",
      confirmationEvidence: "post-restart-verification",
    });
  }
  return classifyPersistedSubmission(userId, attemptId, stored);
}

export async function recoverExternalSubmission(userId: string, attemptId: string): Promise<ReturnType<typeof classifyInterruptedSubmission>> {
  const disposition = await classifyPersistedSubmission(userId, attemptId);
  const attempt = await loadOwnedAttempt(userId, attemptId);
  if (!attempt) throw new ExternalSubmissionRejected("OWNERSHIP_MISMATCH");
  if (disposition === "ALREADY_FINALIZED") return disposition;
  if (disposition === "CONFIRMED_NEEDS_LOCAL_RECONCILIATION") {
    const evidence = evidenceOf(attempt.verificationEvidenceJson);
    if (evidence.trustedConfirmation !== true) {
      await persistTrustedConfirmation(userId, attempt.id, {
        confirmationType: attempt.confirmationType ?? "provider-confirmation",
        confirmationReference: attempt.providerApplicationId,
        confirmationEvidence: "reconciliation",
      });
    }
    if (attempt.externalPhase !== "CONFIRMATION_OBSERVED" && attempt.externalPhase !== "CONFIRMATION_PERSISTED" && attempt.externalPhase !== "LOCAL_FINALIZATION_COMPLETED") {
      await project(
        attempt,
        "CONFIRMATION_OBSERVED",
        "CONFIRMATION_EVIDENCE_OBSERVED",
        "Trusted confirmation is ready for local reconciliation.",
        { provider: attempt.executionSession.provider },
        { confirmationObservedAt: attempt.confirmationObservedAt ?? new Date(), confirmationStrength: attempt.confirmationStrength ?? "DEFINITIVE" },
      );
    }
    if (attempt.externalPhase === "CONFIRMATION_OBSERVED") {
      await project(
        attempt,
        "CONFIRMATION_PERSISTED",
        "CONFIRMATION_PERSISTED",
        "Trusted confirmation was durably persisted before local finalization.",
        { provider: attempt.executionSession.provider },
        { confirmationPersistedAt: attempt.confirmationPersistedAt ?? new Date() },
      );
    }
    const finalized = await finalizeConfirmedSubmission({
      userId,
      submissionAttemptId: attempt.id,
    });
    if (finalized === "FINALIZED" || finalized === "ALREADY_FINALIZED") {
      await project(
        attempt,
        "LOCAL_FINALIZATION_COMPLETED",
        "LOCAL_RECONCILIATION_COMPLETED",
        "Local reconciliation completed without another provider submit.",
        { provider: attempt.executionSession.provider },
        { recoveryDisposition: "ALREADY_FINALIZED" },
      );
      return "ALREADY_FINALIZED";
    }
    return disposition;
  }
  if (disposition === "SAFE_TO_RETRY" && attempt.authorization?.state === "ISSUED" && !attempt.clickAttemptStartedAt) {
    await cancelSubmitAuthorization(userId, attempt.authorization.id);
  }
  return disposition;
}

export async function resolveSubmissionManually(input: {
  userId: string;
  applicationId: string;
  attemptId: string;
  resolution: "CONFIRMED_SUBMITTED" | "CONFIRMED_NOT_SUBMITTED";
  note?: string | null;
}): Promise<ReturnType<typeof classifyInterruptedSubmission>> {
  const attempt = await loadOwnedAttempt(input.userId, input.attemptId);
  if (!attempt || attempt.applicationId !== input.applicationId) throw new ExternalSubmissionRejected("OWNERSHIP_MISMATCH");
  const disposition = await classifyPersistedSubmission(input.userId, input.attemptId);
  if (!requiresManualReview(disposition) && disposition !== "SUBMIT_UNCERTAIN") {
    throw new ExternalSubmissionRejected("MANUAL_RESOLUTION_NOT_ALLOWED");
  }
  const note = input.note?.trim() || null;
  if (input.resolution === "CONFIRMED_SUBMITTED") {
    await project(
      attempt,
      "CONFIRMATION_OBSERVED",
      "MANUAL_CONFIRMATION_RECORDED",
      "The user confirmed this application was submitted.",
      { note },
      {
        confirmationObservedAt: attempt.confirmationObservedAt ?? new Date(),
        confirmationStrength: "DEFINITIVE",
        confirmationType: "manual-user-verification",
        submitBoundaryCrossedAt: attempt.submitBoundaryCrossedAt ?? attempt.clickAttemptStartedAt ?? new Date(),
      },
    );
    await persistTrustedConfirmation(input.userId, attempt.id, {
      confirmationType: "manual-user-verification",
      confirmationEvidence: "manual-user-verification",
    });
    await project(
      attempt,
      "CONFIRMATION_PERSISTED",
      "CONFIRMATION_PERSISTED",
      "Manual confirmation was durably persisted.",
      {},
      { confirmationPersistedAt: new Date() },
    );
    const finalized = await finalizeConfirmedSubmission({
      userId: input.userId,
      submissionAttemptId: attempt.id,
    });
    if (finalized !== "FINALIZED" && finalized !== "ALREADY_FINALIZED") {
      throw new ExternalSubmissionRejected("LOCAL_FINALIZATION_FAILED");
    }
    await project(
      attempt,
      "LOCAL_FINALIZATION_COMPLETED",
      "LOCAL_RECONCILIATION_COMPLETED",
      "Manual confirmation was finalized locally.",
      {},
      { recoveryDisposition: "ALREADY_FINALIZED" },
    );
    return "ALREADY_FINALIZED";
  }

  const resolutionEvidence = evidenceOf(attempt.verificationEvidenceJson);
  resolutionEvidence.manualResolution = "CONFIRMED_NOT_SUBMITTED";
  await project(
    attempt,
    attempt.externalPhase ?? "CLICK_ATTEMPT_STARTED",
    "MANUAL_NOT_SUBMITTED_RECORDED",
    "The user confirmed this application was not submitted.",
    { note },
    {
      status: "FAILED",
      failureCode: null,
      failureMessage: "User confirmed the previous attempt was not submitted.",
      recoveryDisposition: "SAFE_TO_RETRY",
      verificationEvidenceJson: toPrismaJson(resolutionEvidence),
    },
    { status: "FAILED", failureCode: null, failureMessage: null },
  );
  return "SAFE_TO_RETRY";
}

export async function issueRetryAuthorization(
  userId: string,
  attemptId: string,
): Promise<{ ok: true; attemptId: string; authorizationId: string; token: string } | { ok: false; reason: string }> {
  const attempt = await loadOwnedAttempt(userId, attemptId);
  if (!attempt) return { ok: false, reason: "OWNERSHIP_MISMATCH" };
  const disposition = await classifyPersistedSubmission(userId, attemptId);
  if (!canRetryDisposition(disposition)) return { ok: false, reason: "RETRY_NOT_ALLOWED" };
  if (attempt.authorization?.state === "ISSUED") {
    await cancelSubmitAuthorization(userId, attempt.authorization.id);
  }
  const nextNumber = attempt.attemptNumber + 1;
  if (attempt.status === "APPROVAL_GRANTED" || attempt.status === "SUBMITTING" || attempt.status === "VERIFYING") {
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { status: "CANCELLED" },
    });
  }
  let created: { id: string; applicationId: string; applicationPackageId: string };
  try {
    created = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId,
        executionSessionId: attempt.executionSessionId,
        applicationPackageId: attempt.applicationPackageId,
        applicationId: attempt.applicationId,
        attemptNumber: nextNumber,
        method: attempt.method,
        status: "APPROVAL_GRANTED",
        approvalFingerprint: `m33-retry:${attempt.id}:${nextNumber}`,
        idempotencyKey: `m33-retry:${attempt.id}:${nextNumber}`,
        destinationUrl: attempt.destinationUrl,
        resumeVersionRevisionId: attempt.resumeVersionRevisionId,
        resumeFileHash: attempt.resumeFileHash,
        coverLetterRevisionId: attempt.coverLetterRevisionId,
        coverLetterFileHash: attempt.coverLetterFileHash,
        externalPhase: "EXECUTION_STARTED",
      },
      select: { id: true, applicationId: true, applicationPackageId: true },
    });
  } catch (error) {
    if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "RETRY_CONFLICT" };
    }
    throw error;
  }
  const issued = await issueSubmitAuthorization(userId, {
    applicationId: created.applicationId,
    packageId: created.applicationPackageId,
    attemptId: created.id,
  });
  if (!issued.ok) return issued;
  return { ok: true, attemptId: created.id, authorizationId: issued.authorizationId, token: issued.token };
}

export async function recordDryRunCertification(
  userId: string,
  authorizationId: string,
  status: "DRY_RUN_CERTIFIED" | "DRY_RUN_FAILED",
): Promise<boolean> {
  const updated = await prisma.applicationSubmitAuthorization.updateMany({
    where: { id: authorizationId, userId, state: "ISSUED" },
    data: {
      dryRunStatus: status,
      dryRunCertifiedAt: status === "DRY_RUN_CERTIFIED" ? new Date() : null,
    },
  });
  return updated.count === 1;
}

export type SubmissionAuditView = {
  attemptId: string | null;
  packageId: string | null;
  packageHash: string | null;
  provider: string | null;
  phase: string | null;
  recoveryDisposition: string | null;
  confirmationStrength: string | null;
  confirmationType: string | null;
  providerReference: string | null;
  adapterVersion: string | null;
  selectorStrategyVersion: string | null;
  confirmationStrategyVersion: string | null;
  canRetry: boolean;
  canVerify: boolean;
  requiresManualReview: boolean;
  uncertain: boolean;
  verificationResult: string | null;
};

export async function getSubmissionAudit(userId: string, applicationId: string): Promise<SubmissionAuditView> {
  const empty: SubmissionAuditView = {
    attemptId: null,
    packageId: null,
    packageHash: null,
    provider: null,
    phase: null,
    recoveryDisposition: null,
    confirmationStrength: null,
    confirmationType: null,
    providerReference: null,
    adapterVersion: null,
    selectorStrategyVersion: null,
    confirmationStrategyVersion: null,
    canRetry: false,
    canVerify: false,
    requiresManualReview: false,
    uncertain: false,
    verificationResult: null,
  };
  const application = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  if (!application) return empty;
  const latest = await prisma.applicationSubmissionAttempt.findFirst({
    where: { applicationId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return empty;
  const [session, pack] = await Promise.all([
    prisma.applicationExecutionSession.findUnique({ where: { id: latest.executionSessionId }, select: { provider: true } }),
    prisma.applicationPackage.findUnique({ where: { id: latest.applicationPackageId }, select: { id: true, packageHash: true } }),
  ]);
  const evidence = evidenceOf(latest.verificationEvidenceJson);
  const capability = capabilityOf(evidence, LOCAL_QA_CAPABILITY);
  let disposition = latest.recoveryDisposition;
  if (!disposition) {
    try {
      disposition = await classifyPersistedSubmission(userId, latest.id, capability, { persist: false });
    } catch {
      disposition = null;
    }
  }
  const verification = evidence.verificationResult;
  return {
    attemptId: latest.id,
    packageId: pack?.id ?? latest.applicationPackageId,
    packageHash: pack?.packageHash ?? null,
    provider: session?.provider ?? null,
    phase: latest.externalPhase,
    recoveryDisposition: disposition,
    confirmationStrength: latest.confirmationStrength,
    confirmationType: latest.confirmationType,
    providerReference: latest.providerApplicationId,
    adapterVersion: latest.providerAdapterVersion,
    selectorStrategyVersion: latest.selectorStrategyVersion,
    confirmationStrategyVersion: latest.confirmationStrategyVersion,
    canRetry: disposition ? canRetryDisposition(disposition) : false,
    canVerify: disposition ? canVerifyDisposition(disposition, capability) : false,
    requiresManualReview: disposition ? requiresManualReview(disposition) : false,
    uncertain: disposition ? submissionMayHaveReachedProvider(disposition) : false,
    verificationResult: typeof verification === "string" ? verification : null,
  };
}
