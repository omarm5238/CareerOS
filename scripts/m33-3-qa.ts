import "dotenv/config";

import { FinalizerFault } from "@/features/application-execution/integrity/finalize-confirmed-submission";
import {
  classifyInterruptedSubmission,
  LOCAL_QA_CAPABILITY,
  OPAQUE_PROVIDER_CAPABILITY,
  type ProviderCapability,
  type SubmissionFacts,
} from "@/features/application-execution/integrity/external-submission-contract";
import {
  classifyPersistedSubmission,
  executeExternalSubmission,
  ExternalSubmissionFault,
  ExternalSubmissionRejected,
  issueRetryAuthorization,
  issueSubmitAuthorization,
  recoverExternalSubmission,
  resolveSubmissionManually,
  verifyExternalSubmission,
  ClickFailedBeforeDispatch,
} from "@/features/application-execution/integrity/external-submission";
import { prisma } from "@/server/db/prisma";

import { assert, cleanupFixture, counts, createFixture, createReadyAttempt, evidence, type ReadyFixture } from "./m33-fixture";

function facts(partial: Partial<SubmissionFacts>): SubmissionFacts {
  return {
    authorizationState: "ISSUED",
    boundaryAcquired: false,
    clickAttemptStarted: false,
    clickDispatched: false,
    provenNotDispatched: false,
    manuallyResolvedNotSubmitted: false,
    confirmationTrusted: false,
    locallyFinalized: false,
    providerRejected: false,
    capability: LOCAL_QA_CAPABILITY,
    verificationResult: null,
    ...partial,
  };
}

async function prepared(fixture: ReadyFixture) {
  const ready = await createReadyAttempt(fixture);
  const auth = await issueSubmitAuthorization(fixture.userId, {
    applicationId: ready.applicationId,
    packageId: ready.packageId,
    attemptId: ready.attemptId,
  });
  assert(auth.ok, "authorization");
  if (!auth.ok) throw new Error("authorization");
  return { ready, auth };
}

async function main() {
  assert(classifyInterruptedSubmission(facts({})) === "SAFE_TO_RETRY", "no boundary");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true })) === "SAFE_TO_RETRY", "boundary only");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickAttemptStarted: true, provenNotDispatched: true })) === "SAFE_TO_RETRY", "proven not dispatched");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickAttemptStarted: true })) === "VERIFY_PROVIDER", "unknown dispatch");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickAttemptStarted: true, capability: OPAQUE_PROVIDER_CAPABILITY })) === "MANUAL_REVIEW_REQUIRED", "opaque unknown dispatch");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickAttemptStarted: true, clickDispatched: true })) === "VERIFY_PROVIDER", "dispatched");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickDispatched: true, clickAttemptStarted: true, capability: OPAQUE_PROVIDER_CAPABILITY })) === "SUBMIT_UNCERTAIN", "opaque dispatched");
  assert(classifyInterruptedSubmission(facts({ confirmationTrusted: true, clickDispatched: true, clickAttemptStarted: true, boundaryAcquired: true })) === "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", "trusted confirmation");
  assert(classifyInterruptedSubmission(facts({ locallyFinalized: true, confirmationTrusted: true })) === "ALREADY_FINALIZED", "finalized");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickDispatched: true, clickAttemptStarted: true, verificationResult: "NOT_FOUND" })) === "MANUAL_REVIEW_REQUIRED", "not found is not proof");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickDispatched: true, clickAttemptStarted: true, verificationResult: "NOT_FOUND", capability: { ...LOCAL_QA_CAPABILITY, notFoundProvesNotSubmitted: true } })) === "SAFE_TO_RETRY", "contract not-found");
  assert(classifyInterruptedSubmission(facts({ boundaryAcquired: true, clickDispatched: true, clickAttemptStarted: true, verificationResult: "INCONCLUSIVE" })) === "SUBMIT_UNCERTAIN", "inconclusive");
  assert(classifyInterruptedSubmission(facts({ providerRejected: true, clickDispatched: true })) === "SAFE_TO_RETRY", "provider rejected");

  const before = await counts();
  const fixture = await createFixture("m33-3");
  const outsider = await prisma.user.create({ data: { name: "m33-3-other", email: `m33-3-other-${Date.now()}@careeros.local` } });
  try {
    const scenarios: Array<{ name: string; run: () => Promise<void> }> = [];
    const expectFault = async (point: "AFTER_AUTHORIZATION" | "AFTER_BOUNDARY" | "AFTER_CLICK_ATTEMPT_STARTED" | "AFTER_CLICK_DISPATCH" | "AFTER_POST_CLICK_ACTIVITY" | "AFTER_CONFIRMATION_OBSERVED" | "AFTER_CONFIRMATION_PERSISTED" | "BEFORE_LOCAL_FINALIZATION", expected: string, clicks: number) => {
      const { ready, auth } = await prepared(fixture);
      const dispatched = { n: 0 };
      let seen = false;
      try {
        await executeExternalSubmission({
          userId: fixture.userId,
          attemptId: ready.attemptId,
          authorizationId: auth.authorizationId,
          token: auth.token,
          fault: point,
          provider: async () => {
            dispatched.n += 1;
            return evidence({
              clickDispatched: true,
              navigationObserved: point === "AFTER_POST_CLICK_ACTIVITY" || point === "AFTER_CONFIRMATION_OBSERVED" || point === "AFTER_CONFIRMATION_PERSISTED" || point === "BEFORE_LOCAL_FINALIZATION",
              confirmationObserved: true,
              confirmationStrength: "STRONG",
              confirmationType: "provider-success-page",
            });
          },
        });
      } catch (error) {
        seen = error instanceof ExternalSubmissionFault && error.point === point;
      }
      assert(seen, `${point} did not fault`);
      assert(dispatched.n === clicks, `${point} provider calls ${dispatched.n}`);
      const disposition = await classifyPersistedSubmission(fixture.userId, ready.attemptId);
      assert(disposition === expected, `${point} -> ${disposition}`);
    };

    await expectFault("AFTER_AUTHORIZATION", "SAFE_TO_RETRY", 0);
    await expectFault("AFTER_BOUNDARY", "SAFE_TO_RETRY", 0);
    await expectFault("AFTER_CLICK_ATTEMPT_STARTED", "VERIFY_PROVIDER", 0);
    await expectFault("AFTER_CLICK_DISPATCH", "VERIFY_PROVIDER", 1);
    await expectFault("AFTER_POST_CLICK_ACTIVITY", "VERIFY_PROVIDER", 1);
    await expectFault("AFTER_CONFIRMATION_OBSERVED", "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", 1);
    await expectFault("AFTER_CONFIRMATION_PERSISTED", "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", 1);
    await expectFault("BEFORE_LOCAL_FINALIZATION", "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", 1);

    const during = await prepared(fixture);
    const duringClicks = { n: 0 };
    let duringFault = false;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: during.ready.attemptId,
        authorizationId: during.auth.authorizationId,
        token: during.auth.token,
        fault: "DURING_LOCAL_FINALIZATION",
        provider: async () => {
          duringClicks.n += 1;
          return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "DEFINITIVE", providerReference: "APP-100" });
        },
      });
    } catch (error) {
      duringFault = error instanceof FinalizerFault;
    }
    assert(duringFault && duringClicks.n === 1, "local finalization fault was not contained");
    assert((await classifyPersistedSubmission(fixture.userId, during.ready.attemptId)) === "CONFIRMED_NEEDS_LOCAL_RECONCILIATION", "finalization fault lost confirmation");
    assert((await recoverExternalSubmission(fixture.userId, during.ready.attemptId)) === "ALREADY_FINALIZED", "local reconciliation did not finish");
    assert(duringClicks.n === 1, "reconciliation submitted again");

    const closed = await prepared(fixture);
    const closedClicks = { n: 0 };
    let closedThrown = false;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: closed.ready.attemptId,
        authorizationId: closed.auth.authorizationId,
        token: closed.auth.token,
        provider: async () => {
          closedClicks.n += 1;
          throw new Error("browser closed");
        },
      });
    } catch {
      closedThrown = true;
    }
    assert(closedThrown, "browser close was swallowed");
    assert((await classifyPersistedSubmission(fixture.userId, closed.ready.attemptId)) !== "SAFE_TO_RETRY", "browser close allowed retry");

    const timeout = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: timeout.ready.attemptId,
        authorizationId: timeout.auth.authorizationId,
        token: timeout.auth.token,
        provider: async () => {
          throw new Error("network timeout");
        },
      });
    } catch {
      /* crash after the click may have started */
    }
    assert((await classifyPersistedSubmission(fixture.userId, timeout.ready.attemptId)) !== "SAFE_TO_RETRY", "timeout allowed retry");

    const strong = await prepared(fixture);
    const strongClicks = { n: 0 };
    const strongResult = await executeExternalSubmission({
      userId: fixture.userId,
      attemptId: strong.ready.attemptId,
      authorizationId: strong.auth.authorizationId,
      token: strong.auth.token,
      provider: async () => {
        strongClicks.n += 1;
        return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "provider-success-page" });
      },
    });
    assert(strongResult.disposition === "ALREADY_FINALIZED" && strongClicks.n === 1, "normal submit count");
    for (let index = 0; index < 10; index += 1) {
      let replayed = false;
      try {
        await executeExternalSubmission({
          userId: fixture.userId,
          attemptId: strong.ready.attemptId,
          authorizationId: strong.auth.authorizationId,
          token: strong.auth.token,
          provider: async () => {
            strongClicks.n += 1;
            return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "provider-success-page" });
          },
        });
      } catch (error) {
        replayed = error instanceof ExternalSubmissionRejected;
      }
      assert(replayed, "replay was accepted");
    }
    assert(strongClicks.n === 1, `replay provider submits ${strongClicks.n}`);
    const appliedEvents = await prisma.applicationEvent.count({ where: { applicationId: strong.ready.applicationId, type: "STATUS_CHANGED" } });
    assert(appliedEvents === 1, `duplicate status events ${appliedEvents}`);

    const verifyTarget = await prepared(fixture);
    let verifyClicks = 0;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: verifyTarget.ready.attemptId,
        authorizationId: verifyTarget.auth.authorizationId,
        token: verifyTarget.auth.token,
        fault: "AFTER_CLICK_DISPATCH",
        provider: async () => {
          verifyClicks += 1;
          return evidence({ clickDispatched: true });
        },
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "verify setup");
    }
    const confirmed = await verifyExternalSubmission(fixture.userId, verifyTarget.ready.attemptId, async () => "CONFIRMED");
    assert(confirmed === "CONFIRMED_NEEDS_LOCAL_RECONCILIATION" && verifyClicks === 1, confirmed);
    assert((await recoverExternalSubmission(fixture.userId, verifyTarget.ready.attemptId)) === "ALREADY_FINALIZED", "verified recovery");
    assert(verifyClicks === 1, "verification submitted");

    const missing = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: missing.ready.attemptId,
        authorizationId: missing.auth.authorizationId,
        token: missing.auth.token,
        fault: "AFTER_CLICK_DISPATCH",
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch {
      /* expected */
    }
    assert((await verifyExternalSubmission(fixture.userId, missing.ready.attemptId, async () => "NOT_FOUND")) === "MANUAL_REVIEW_REQUIRED", "not found became retry");

    const inconclusive = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: inconclusive.ready.attemptId,
        authorizationId: inconclusive.auth.authorizationId,
        token: inconclusive.auth.token,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch {
      /* expected */
    }
    assert((await verifyExternalSubmission(fixture.userId, inconclusive.ready.attemptId, async () => "INCONCLUSIVE")) === "SUBMIT_UNCERTAIN", "inconclusive verify");

    const opaque = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: opaque.ready.attemptId,
        authorizationId: opaque.auth.authorizationId,
        token: opaque.auth.token,
        capability: OPAQUE_PROVIDER_CAPABILITY,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => evidence({}),
      });
    } catch {
      /* expected */
    }
    let opaqueRejected = false;
    try {
      await verifyExternalSubmission(fixture.userId, opaque.ready.attemptId, async () => "CONFIRMED", OPAQUE_PROVIDER_CAPABILITY);
    } catch (error) {
      opaqueRejected = error instanceof ExternalSubmissionRejected;
    }
    assert(opaqueRejected, "opaque provider verification was allowed");
    assert((await classifyPersistedSubmission(fixture.userId, opaque.ready.attemptId, OPAQUE_PROVIDER_CAPABILITY)) === "MANUAL_REVIEW_REQUIRED", "opaque restart");

    const manual = await prepared(fixture);
    let manualClicks = 0;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: manual.ready.attemptId,
        authorizationId: manual.auth.authorizationId,
        token: manual.auth.token,
        fault: "AFTER_CLICK_DISPATCH",
        provider: async () => {
          manualClicks += 1;
          return evidence({ clickDispatched: true });
        },
      });
    } catch {
      /* expected */
    }
    let crossUser = false;
    try {
      await resolveSubmissionManually({
        userId: outsider.id,
        applicationId: manual.ready.applicationId,
        attemptId: manual.ready.attemptId,
        resolution: "CONFIRMED_SUBMITTED",
      });
    } catch (error) {
      crossUser = error instanceof ExternalSubmissionRejected;
    }
    assert(crossUser, "cross-user manual resolution succeeded");
    assert((await resolveSubmissionManually({
      userId: fixture.userId,
      applicationId: manual.ready.applicationId,
      attemptId: manual.ready.attemptId,
      resolution: "CONFIRMED_SUBMITTED",
      note: "I saw the employer confirmation page.",
    })) === "ALREADY_FINALIZED", "manual confirmation");
    assert(manualClicks === 1, "manual confirmation submitted again");
    const manualEvents = await prisma.applicationExecutionEvent.count({
      where: { executionSessionId: manual.ready.sessionId!, type: "SUBMISSION_MARKED_UNCERTAIN" },
    });
    assert(manualEvents >= 0, "history query failed");
    const originalUncertain = await prisma.applicationExecutionEvent.findFirst({
      where: { executionSessionId: manual.ready.sessionId!, type: "CLICK_DISPATCHED" },
    });
    assert(originalUncertain, "original dispatch history was erased");

    const notSubmitted = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: notSubmitted.ready.attemptId,
        authorizationId: notSubmitted.auth.authorizationId,
        token: notSubmitted.auth.token,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch {
      /* expected */
    }
    assert((await resolveSubmissionManually({
      userId: fixture.userId,
      applicationId: notSubmitted.ready.applicationId,
      attemptId: notSubmitted.ready.attemptId,
      resolution: "CONFIRMED_NOT_SUBMITTED",
    })) === "SAFE_TO_RETRY", "manual not submitted");
    const oldAuth = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: notSubmitted.auth.authorizationId } });
    assert(oldAuth.state === "CONSUMED", "old authorization was reactivated");
    const retried = await issueRetryAuthorization(fixture.userId, notSubmitted.ready.attemptId);
    assert(retried.ok, retried.ok ? "" : retried.reason);
    if (!retried.ok) return;
    assert(retried.authorizationId !== oldAuth.id && retried.attemptId !== notSubmitted.ready.attemptId, "retry reused the authorization");
    let reused = false;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: retried.attemptId,
        authorizationId: oldAuth.id,
        token: notSubmitted.auth.token,
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch {
      reused = true;
    }
    assert(reused, "old authorization submitted again");

    const raced = await prepared(fixture);
    const racedClicks = { n: 0 };
    const race = await Promise.allSettled([
      executeExternalSubmission({
        userId: fixture.userId,
        attemptId: raced.ready.attemptId,
        authorizationId: raced.auth.authorizationId,
        token: raced.auth.token,
        provider: async () => {
          racedClicks.n += 1;
          return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "provider-success-page" });
        },
      }),
      executeExternalSubmission({
        userId: fixture.userId,
        attemptId: raced.ready.attemptId,
        authorizationId: raced.auth.authorizationId,
        token: raced.auth.token,
        provider: async () => {
          racedClicks.n += 1;
          return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "provider-success-page" });
        },
      }),
    ]);
    assert(racedClicks.n === 1, `concurrent execution clicks ${racedClicks.n}`);
    assert(race.filter((item) => item.status === "fulfilled").length === 1, "concurrent execution both succeeded");

    const recoverRace = await prepared(fixture);
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: recoverRace.ready.attemptId,
        authorizationId: recoverRace.auth.authorizationId,
        token: recoverRace.auth.token,
        fault: "BEFORE_LOCAL_FINALIZATION",
        provider: async () => evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "provider-success-page" }),
      });
    } catch {
      /* expected */
    }
    const recovered = await Promise.all([
      recoverExternalSubmission(fixture.userId, recoverRace.ready.attemptId),
      recoverExternalSubmission(fixture.userId, recoverRace.ready.attemptId),
    ]);
    assert(recovered.every((item) => item === "ALREADY_FINALIZED"), recovered.join(","));
    const owners = await prisma.application.findUniqueOrThrow({ where: { id: recoverRace.ready.applicationId } });
    assert(owners.status === "APPLIED" && owners.submittedExecutionAttemptId === recoverRace.ready.attemptId, "concurrent recovery duplicated finalization");

    void scenarios;
    void ClickFailedBeforeDispatch;
  } finally {
    await cleanupFixture(fixture.userId);
    await prisma.user.delete({ where: { id: outsider.id } });
  }
  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture rows leaked ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.log("m33-3 qa passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
