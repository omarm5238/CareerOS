import "dotenv/config";

import { chromium, type Page } from "playwright";

import {
  executeExternalSubmission,
  ExternalSubmissionFault,
  issueSubmitAuthorization,
} from "@/features/application-execution/integrity/external-submission";
import { prisma } from "@/server/db/prisma";

import { assert, attachFixture, cleanupFixture, createReadyAttempt, evidence } from "./m33-fixture";

const BASE = "http://localhost:3000";

function watch(page: Page) {
  const problems: string[] = [];
  const apiFailures: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|Failed to load resource/i.test(text)) return;
    problems.push(text);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/applications/") && response.status() >= 500) apiFailures.push(`${response.status()} ${url}`);
  });
  return { problems, apiFailures };
}

async function openApplication(page: Page, applicationId: string) {
  await page.goto(`${BASE}/workspace/applications/${applicationId}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid=external-submission][data-hydrated=true]").waitFor({ timeout: 30000 });
}

async function clickSubmissionAction(page: Page, name: string, urlPart: string) {
  const button = page.getByRole("button", { name });
  await button.waitFor();
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(urlPart),
    { timeout: 30000 },
  );
  await button.click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`${urlPart} failed ${response.status()} ${await response.text()}`);
  return response;
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const diagnostics = watch(page);
  let userId: string | null = null;
  try {
    const email = `m33-headed-${Date.now()}@careeros.local`;
    const signup = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email, password: "Milestone33Test!", name: "M33 Headed" },
    });
    if (!signup.ok()) throw new Error(`Sign-up failed: ${signup.status()} ${await signup.text()}`);
    const body = (await signup.json()) as { user?: { id?: string } };
    userId = body.user?.id ?? null;
    if (!userId) throw new Error("Sign-up did not return a user id");
    const fixture = await attachFixture(userId);

    const confirmed = await createReadyAttempt(fixture);
    const confirmedAuth = await issueSubmitAuthorization(userId, {
      applicationId: confirmed.applicationId,
      packageId: confirmed.packageId,
      attemptId: confirmed.attemptId,
    });
    assert(confirmedAuth.ok, "confirmed authorization");
    if (!confirmedAuth.ok) return;
    const confirmedClicks = { n: 0 };
    const confirmedResult = await executeExternalSubmission({
      userId,
      attemptId: confirmed.attemptId,
      authorizationId: confirmedAuth.authorizationId,
      token: confirmedAuth.token,
      versions: {
        providerAdapterVersion: "adapter-A",
        selectorStrategyVersion: "selector-A",
        confirmationStrategyVersion: "confirmation-A",
      },
      provider: async () => {
        confirmedClicks.n += 1;
        return evidence({
          clickDispatched: true,
          confirmationObserved: true,
          confirmationStrength: "DEFINITIVE",
          providerReference: "APP-HEADED",
        });
      },
    });
    assert(confirmedResult.disposition === "ALREADY_FINALIZED" && confirmedClicks.n === 1, confirmedResult.disposition);
    await openApplication(page, confirmed.applicationId);
    await page.getByText("Applied", { exact: true }).waitFor();
    await page.getByTestId("external-phase").filter({ hasText: "LOCAL_FINALIZATION_COMPLETED" }).waitFor();
    await page.getByTestId("external-reference").filter({ hasText: "APP-HEADED" }).waitFor();
    await page.getByTestId("external-adapter").filter({ hasText: "adapter-A" }).waitFor();
    assert(await page.getByRole("button", { name: "Retry with new authorization" }).count() === 0, "finalized submission offered retry");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("external-reference").filter({ hasText: "APP-HEADED" }).waitFor({ timeout: 30000 });
    assert(confirmedClicks.n === 1, "refresh submitted again");

    const boundary = await createReadyAttempt(fixture);
    const boundaryAuth = await issueSubmitAuthorization(userId, {
      applicationId: boundary.applicationId,
      packageId: boundary.packageId,
      attemptId: boundary.attemptId,
    });
    assert(boundaryAuth.ok, "boundary authorization");
    if (!boundaryAuth.ok) return;
    let boundaryCalls = 0;
    try {
      await executeExternalSubmission({
        userId,
        attemptId: boundary.attemptId,
        authorizationId: boundaryAuth.authorizationId,
        token: boundaryAuth.token,
        fault: "AFTER_BOUNDARY",
        provider: async () => {
          boundaryCalls += 1;
          return evidence({ clickDispatched: true });
        },
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "boundary fault");
    }
    assert(boundaryCalls === 0, "boundary-only flow submitted");
    await openApplication(page, boundary.applicationId);
    await page.getByTestId("external-phase").filter({ hasText: "SUBMIT_BOUNDARY_ACQUIRED" }).waitFor();
    await page.getByTestId("external-recovery").filter({ hasText: "SAFE_TO_RETRY" }).waitFor();
    assert(await page.getByTestId("external-uncertain").count() === 0, "boundary-only flow looked uncertain");

    const clickAttempt = await createReadyAttempt(fixture);
    const clickAuth = await issueSubmitAuthorization(userId, {
      applicationId: clickAttempt.applicationId,
      packageId: clickAttempt.packageId,
      attemptId: clickAttempt.attemptId,
    });
    assert(clickAuth.ok, "click authorization");
    if (!clickAuth.ok) return;
    let clickCalls = 0;
    try {
      await executeExternalSubmission({
        userId,
        attemptId: clickAttempt.attemptId,
        authorizationId: clickAuth.authorizationId,
        token: clickAuth.token,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => {
          clickCalls += 1;
          return evidence({ clickDispatched: true });
        },
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "click fault");
    }
    await openApplication(page, clickAttempt.applicationId);
    await page.getByText("The submit action may have reached the employer.").waitFor();
    await page.getByText("CareerOS will not submit this application again automatically.").waitFor();
    assert(await page.getByRole("button", { name: "Retry with new authorization" }).count() === 0, "uncertain click offered retry");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("The submit action may have reached the employer.").waitFor({ timeout: 30000 });
    assert(clickCalls === 0, "refresh retried an uncertain click");

    const dispatched = await createReadyAttempt(fixture);
    const dispatchedAuth = await issueSubmitAuthorization(userId, {
      applicationId: dispatched.applicationId,
      packageId: dispatched.packageId,
      attemptId: dispatched.attemptId,
    });
    assert(dispatchedAuth.ok, "dispatch authorization");
    if (!dispatchedAuth.ok) return;
    const dispatchedClicks = { n: 0 };
    try {
      await executeExternalSubmission({
        userId,
        attemptId: dispatched.attemptId,
        authorizationId: dispatchedAuth.authorizationId,
        token: dispatchedAuth.token,
        fault: "AFTER_CLICK_DISPATCH",
        provider: async () => {
          dispatchedClicks.n += 1;
          return evidence({ clickDispatched: true, observedText: "Thank you" });
        },
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "dispatch fault");
    }
    await openApplication(page, dispatched.applicationId);
    await page.getByTestId("external-phase").filter({ hasText: "CLICK_DISPATCHED" }).waitFor();
    await page.getByText("CareerOS will not submit this application again automatically.").waitFor();
    assert(await page.getByRole("button", { name: "Retry with new authorization" }).count() === 0, "dispatched attempt offered retry");
    await clickSubmissionAction(page, "Verify submission", "/submission/verify");
    await page.getByTestId("external-verification").filter({ hasText: "INCONCLUSIVE" }).waitFor({ timeout: 30000 });
    assert(dispatchedClicks.n === 1, "verification submitted again");
    assert(await page.getByRole("button", { name: "Retry with new authorization" }).count() === 0, "inconclusive verification offered retry");

    const manual = await createReadyAttempt(fixture);
    const manualAuth = await issueSubmitAuthorization(userId, {
      applicationId: manual.applicationId,
      packageId: manual.packageId,
      attemptId: manual.attemptId,
    });
    assert(manualAuth.ok, "manual authorization");
    if (!manualAuth.ok) return;
    const manualClicks = { n: 0 };
    try {
      await executeExternalSubmission({
        userId,
        attemptId: manual.attemptId,
        authorizationId: manualAuth.authorizationId,
        token: manualAuth.token,
        fault: "AFTER_CLICK_DISPATCH",
        provider: async () => {
          manualClicks.n += 1;
          return evidence({ clickDispatched: true });
        },
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "manual fault");
    }
    await openApplication(page, manual.applicationId);
    await clickSubmissionAction(page, "Mark as submitted after manual verification", "/submission/manual-resolution");
    await page.getByText("Applied", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByTestId("external-phase").filter({ hasText: "LOCAL_FINALIZATION_COMPLETED" }).waitFor();
    assert(manualClicks.n === 1, "manual confirmation submitted again");

    const declined = await createReadyAttempt(fixture);
    const declinedAuth = await issueSubmitAuthorization(userId, {
      applicationId: declined.applicationId,
      packageId: declined.packageId,
      attemptId: declined.attemptId,
    });
    assert(declinedAuth.ok, "declined authorization");
    if (!declinedAuth.ok) return;
    try {
      await executeExternalSubmission({
        userId,
        attemptId: declined.attemptId,
        authorizationId: declinedAuth.authorizationId,
        token: declinedAuth.token,
        fault: "AFTER_CLICK_ATTEMPT_STARTED",
        provider: async () => evidence({ clickDispatched: true }),
      });
    } catch (error) {
      assert(error instanceof ExternalSubmissionFault, "declined fault");
    }
    await openApplication(page, declined.applicationId);
    await clickSubmissionAction(page, "Mark as not submitted after manual verification", "/submission/manual-resolution");
    await page.getByRole("button", { name: "Retry with new authorization" }).waitFor({ timeout: 30000 });
    await clickSubmissionAction(page, "Retry with new authorization", "/submission/retry");
    await page.getByTestId("external-phase").filter({ hasText: "EXECUTION_STARTED" }).waitFor({ timeout: 30000 });
    const oldAuthorization = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: declinedAuth.authorizationId } });
    assert(oldAuthorization.state === "CONSUMED", "retry reactivated the old authorization");
    const replacement = await prisma.applicationSubmitAuthorization.findFirst({
      where: { applicationId: declined.applicationId, id: { not: oldAuthorization.id } },
    });
    assert(replacement?.state === "ISSUED", "new authorization was not issued");

    const issue = page.getByText("1 Issue", { exact: true });
    assert(await issue.count() === 0, "Next.js issue badge was visible");
    const hydration = diagnostics.problems.filter((item) => /hydration|did not match/i.test(item));
    if (hydration.length > 0) throw new Error(hydration.join("\n"));
    if (diagnostics.problems.length > 0) throw new Error(diagnostics.problems.join("\n"));
    if (diagnostics.apiFailures.length > 0) throw new Error(diagnostics.apiFailures.join("\n"));
    console.log("m33:headed PASS");
    console.log("visible chromium: true");
    console.log("console errors: 0");
    console.log("hydration errors: 0");
    console.log("next issue badge: absent");
  } finally {
    await browser.close();
    if (userId) await cleanupFixture(userId).catch((error) => console.error(error));
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
