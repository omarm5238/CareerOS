import "dotenv/config";

import {
  assessSubmitControls,
  evaluateProviderConfirmation,
  FINAL_SUBMIT_SELECTOR,
  LOCAL_QA_CAPABILITY,
  PROVIDER_SUCCESS_TYPE,
} from "@/features/application-execution/integrity/external-submission-contract";
import {
  executeExternalSubmission,
  ExternalSubmissionFault,
  issueSubmitAuthorization,
} from "@/features/application-execution/integrity/external-submission";
import { ClickFailedBeforeDispatch } from "@/features/application-execution/integrity/external-submission";
import { prisma } from "@/server/db/prisma";

import { assert, cleanupFixture, counts, createFixture, createReadyAttempt, evidence } from "./m33-fixture";

async function main() {
  assert(assessSubmitControls([]) === "SELECTOR_MISSING", "missing selector");
  assert(assessSubmitControls(["button.preview"]) === "WRONG_SELECTOR", "wrong selector");
  assert(assessSubmitControls([FINAL_SUBMIT_SELECTOR, FINAL_SUBMIT_SELECTOR]) === "DUPLICATE_SUBMIT_CONTROLS", "duplicate selector");
  assert(assessSubmitControls([FINAL_SUBMIT_SELECTOR]) === "OK", "final selector");

  const thankYou = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: PROVIDER_SUCCESS_TYPE, observedText: "Thank you" }), LOCAL_QA_CAPABILITY);
  assert(!thankYou.trusted && thankYou.reason === "GENERIC_TEXT", thankYou.reason);
  const success = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: "success", observedText: "Success" }), LOCAL_QA_CAPABILITY);
  assert(!success.trusted, "generic success was trusted");
  const submitted = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "WEAK", observedText: "Submitted" }), LOCAL_QA_CAPABILITY);
  assert(!submitted.trusted && submitted.strength === "WEAK", "generic submitted was trusted");
  const weak = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "WEAK", observedText: "button disappeared" }), LOCAL_QA_CAPABILITY);
  assert(!weak.trusted, "weak evidence was trusted");
  const strong = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: PROVIDER_SUCCESS_TYPE }), LOCAL_QA_CAPABILITY);
  assert(strong.trusted && strong.strength === "STRONG", "provider success page was rejected");
  const definitive = evaluateProviderConfirmation(evidence({ confirmationObserved: true, confirmationStrength: "DEFINITIVE", providerReference: "APP-88421" }), LOCAL_QA_CAPABILITY);
  assert(definitive.trusted && definitive.strength === "DEFINITIVE", "provider reference was rejected");
  const fakeReference = evaluateProviderConfirmation(evidence({ confirmationStrength: "DEFINITIVE", providerReference: "success" }), LOCAL_QA_CAPABILITY);
  assert(!fakeReference.trusted, "generic reference was trusted");

  const before = await counts();
  const fixture = await createFixture("m33-2");
  try {
    const versions = {
      providerAdapterVersion: "adapter-A",
      selectorStrategyVersion: "selector-A",
      confirmationStrategyVersion: "confirmation-A",
    };
    const boundary = await createReadyAttempt(fixture);
    const boundaryAuth = await issueSubmitAuthorization(fixture.userId, { applicationId: boundary.applicationId, packageId: boundary.packageId, attemptId: boundary.attemptId });
    assert(boundaryAuth.ok, "boundary auth");
    if (!boundaryAuth.ok) return;
    let boundaryCalls = 0;
    let thrown = false;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: boundary.attemptId,
        authorizationId: boundaryAuth.authorizationId,
        token: boundaryAuth.token,
        versions,
        fault: "AFTER_BOUNDARY",
        provider: async () => {
          boundaryCalls += 1;
          return evidence({});
        },
      });
    } catch (error) {
      thrown = error instanceof ExternalSubmissionFault && error.point === "AFTER_BOUNDARY";
    }
    assert(thrown && boundaryCalls === 0, "boundary fault called the provider");
    const boundaryRow = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: boundary.attemptId } });
    assert(boundaryRow.submitBoundaryCrossedAt !== null && boundaryRow.clickAttemptStartedAt === null, "boundary was treated as a click");
    assert(boundaryRow.providerAdapterVersion === "adapter-A", "adapter version was not stored");

    const started = await createReadyAttempt(fixture);
    const startedAuth = await issueSubmitAuthorization(fixture.userId, { applicationId: started.applicationId, packageId: started.packageId, attemptId: started.attemptId });
    assert(startedAuth.ok, "click auth");
    if (!startedAuth.ok) return;
    thrown = false;
    try {
      await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: started.attemptId,
        authorizationId: startedAuth.authorizationId,
        token: startedAuth.token,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch (error) {
      thrown = error instanceof ExternalSubmissionFault;
    }
    assert(thrown, "click attempt was not persisted before the provider");
    const startedRow = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: started.attemptId } });
    assert(startedRow.clickAttemptStartedAt !== null && startedRow.clickDispatchedAt === null, "click attempt did not stay short of dispatch");
    const consumed = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: startedAuth.authorizationId } });
    assert(consumed.state === "CONSUMED", consumed.state);

    async function run(result: ReturnType<typeof evidence>) {
      const ready = await createReadyAttempt(fixture);
      const auth = await issueSubmitAuthorization(fixture.userId, { applicationId: ready.applicationId, packageId: ready.packageId, attemptId: ready.attemptId });
      assert(auth.ok, "run auth");
      if (!auth.ok) throw new Error("auth");
      const outcome = await executeExternalSubmission({
        userId: fixture.userId,
        attemptId: ready.attemptId,
        authorizationId: auth.authorizationId,
        token: auth.token,
        versions,
        provider: async () => result,
      });
      const row = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: ready.attemptId } });
      const application = await prisma.application.findUniqueOrThrow({ where: { id: ready.applicationId } });
      return { outcome, row, application };
    }

    const failed = await (async () => {
      const ready = await createReadyAttempt(fixture);
      const auth = await issueSubmitAuthorization(fixture.userId, { applicationId: ready.applicationId, packageId: ready.packageId, attemptId: ready.attemptId });
      assert(auth.ok, "fail auth");
      if (!auth.ok) throw new Error("auth");
      return executeExternalSubmission({
        userId: fixture.userId,
        attemptId: ready.attemptId,
        authorizationId: auth.authorizationId,
        token: auth.token,
        provider: async () => {
          throw new ClickFailedBeforeDispatch();
        },
      });
    })();
    assert(failed.disposition === "SAFE_TO_RETRY" && failed.providerCalls === 0, failed.disposition);

    const dispatched = await run(evidence({ clickDispatched: true, confirmationStrength: "NONE" }));
    assert(dispatched.row.clickDispatchedAt !== null, "dispatch was not recorded");
    assert(dispatched.application.status === "DRAFT", "dispatch finalized the application");
    assert(dispatched.outcome.disposition !== "SAFE_TO_RETRY", "dispatched attempt was safe to retry");

    const navigation = await run(evidence({ clickDispatched: true, navigationObserved: true, urlAfter: "https://jobs.example/thanks", confirmationStrength: "NONE" }));
    assert(navigation.row.postClickActivityObservedAt !== null && navigation.row.externalPhase !== "CONFIRMATION_PERSISTED", "navigation became confirmation");

    const network = await run(evidence({ clickDispatched: true, networkActivityObserved: true, confirmationStrength: "NONE" }));
    assert(network.row.postClickActivityObservedAt !== null && network.application.status === "DRAFT", "network activity finalized");

    const dom = await run(evidence({ clickDispatched: true, domTransitionObserved: true, confirmationStrength: "WEAK", observedText: "button disappeared" }));
    assert(dom.row.confirmationStrength === "WEAK" && dom.application.status === "DRAFT", "weak DOM finalized");

    const rejectedText = await run(evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: PROVIDER_SUCCESS_TYPE, observedText: "Thank you for applying" }));
    assert(rejectedText.application.status === "DRAFT" && rejectedText.row.confirmationPersistedAt === null, "thank-you text was persisted as confirmation");

    const accepted = await run(evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "STRONG", confirmationType: PROVIDER_SUCCESS_TYPE }));
    assert(accepted.application.status === "APPLIED" && accepted.outcome.providerCalls === 1, accepted.application.status);

    const reference = await run(evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "DEFINITIVE", providerReference: "APP-88421" }));
    assert(reference.application.status === "APPLIED" && reference.row.providerApplicationId === "APP-88421", "provider reference was not stored");

    const providerRejected = await run(evidence({ clickDispatched: true, providerRejected: true, failureClassification: "PROVIDER_REJECTED" }));
    assert(providerRejected.outcome.disposition === "SAFE_TO_RETRY" && providerRejected.application.status === "DRAFT", providerRejected.outcome.disposition);

    const missing = await run(evidence({ failureClassification: "SELECTOR_MISSING" }));
    assert(missing.outcome.disposition === "SAFE_TO_RETRY" && missing.row.clickDispatchedAt === null, "missing selector dispatched");

    const historical = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: boundary.attemptId } });
    assert(historical.providerAdapterVersion === "adapter-A", "historical adapter version changed");
    assert(historical.selectorStrategyVersion === "selector-A", "historical selector version changed");
    assert(historical.confirmationStrategyVersion === "confirmation-A", "historical confirmation version changed");
  } finally {
    await cleanupFixture(fixture.userId);
  }
  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture rows leaked ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.log("m33-2 qa passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
