import "dotenv/config";

import { chromium, type Page } from "playwright";

import { startFixtureServer } from "@/features/application-execution/fixtures/server";
import type { ProviderExecutionResult } from "@/features/application-execution/integrity/execution-domain";
import { persistTrustedConfirmation, reconcileConfirmedSubmission } from "@/features/application-execution/integrity/finalize-confirmed-submission";
import { acquirePackageExecution, executeControlledSubmit } from "@/features/application-execution/integrity/run-package-execution";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { prisma } from "@/server/db/prisma";

const BASE = "http://localhost:3000";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function seedReadyPackage(userId: string) {
  const document = await prisma.resumeDocument.create({
    data: { userId, filename: "cv.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 20, textPreview: "preview" },
  });
  const hash = "d".repeat(64);
  const revision = await prisma.resumeSourceRevision.create({
    data: { userId, resumeDocumentId: document.id, revisionNumber: 1, contentHash: hash, sourceFilename: "cv.pdf", isActive: true },
  });
  const analysis = await prisma.resumeAnalysis.create({
    data: {
      resumeDocumentId: document.id,
      detectedRole: "Software Engineer",
      experienceLevel: "Junior",
      completenessScore: 80,
      detectedSkills: ["TypeScript", "PostgreSQL"],
      suggestedFocus: [],
      warnings: [],
      sourceRevisionId: revision.id,
      sourceContentHash: hash,
      analyzerVersion: RESUME_ANALYZER_VERSION,
      freshness: "CURRENT",
    },
  });
  const description = "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision.";
  const job = await prisma.jobPosting.create({
    data: { userId, title: "Backend Engineer", company: "CareerOS QA", location: "Istanbul", description },
  });
  await prisma.opportunityAnalysisSnapshot.create({
    data: {
      userId,
      jobPostingId: job.id,
      resumeDocumentId: document.id,
      resumeRevisionId: revision.id,
      resumeContentHash: hash,
      resumeAnalysisId: analysis.id,
      jobSnapshotHash: hashJobSnapshot(job),
      canonicalMatchVersion: "m30b-canonical-v1",
      opportunityAnalyzerVersion: "opportunity-analysis-v1",
      status: "COMPLETED",
      snapshotJson: { fixture: true },
    },
  });
  const version = await prisma.resumeVersion.create({
    data: { userId, targetJobId: job.id, title: "Tailored", status: "READY" },
  });
  const tailored = await prisma.resumeVersionRevision.create({
    data: {
      resumeVersionId: version.id,
      userId,
      revisionNumber: 1,
      source: "RULE_BASED_FALLBACK",
      contentJson: { summary: "tailored" },
      keywordCoverageJson: {},
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({ where: { id: version.id }, data: { activeRevisionId: tailored.id } });
  const built = await buildSubmissionPackage(userId, job.id, {
    tailoredResumeVersionId: version.id,
    tailoredResumeRevisionId: tailored.id,
  });
  assert(built.readiness.status === "READY", built.readiness.blockers.join(","));
  return { revisionId: revision.id, packageId: built.packageId, documentId: document.id, analysisId: analysis.id, hash };
}

async function seedAnotherPackage(userId: string, source: { revisionId: string; documentId: string; analysisId: string; hash: string }) {
  const description = "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision.";
  const job = await prisma.jobPosting.create({
    data: { userId, title: `Backend Engineer ${Date.now()}`, company: "CareerOS QA", location: "Istanbul", description },
  });
  await prisma.opportunityAnalysisSnapshot.create({
    data: {
      userId,
      jobPostingId: job.id,
      resumeDocumentId: source.documentId,
      resumeRevisionId: source.revisionId,
      resumeContentHash: source.hash,
      resumeAnalysisId: source.analysisId,
      jobSnapshotHash: hashJobSnapshot(job),
      canonicalMatchVersion: "m30b-canonical-v1",
      opportunityAnalyzerVersion: "opportunity-analysis-v1",
      status: "COMPLETED",
      snapshotJson: { fixture: true },
    },
  });
  const version = await prisma.resumeVersion.create({
    data: { userId, targetJobId: job.id, title: "Tailored", status: "READY" },
  });
  const tailored = await prisma.resumeVersionRevision.create({
    data: {
      resumeVersionId: version.id,
      userId,
      revisionNumber: 1,
      source: "RULE_BASED_FALLBACK",
      contentJson: { summary: "tailored" },
      keywordCoverageJson: {},
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({ where: { id: version.id }, data: { activeRevisionId: tailored.id } });
  const built = await buildSubmissionPackage(userId, job.id, {
    tailoredResumeVersionId: version.id,
    tailoredResumeRevisionId: tailored.id,
  });
  assert(built.readiness.status === "READY", built.readiness.blockers.join(","));
  return { packageId: built.packageId, tailoredId: tailored.id };
}

function provider(mode: "success" | "timeout", clicks: { n: number }) {
  return async (hooks: { onSubmitBoundary: () => Promise<{ proceed: boolean }> }): Promise<ProviderExecutionResult> => {
    const gate = await hooks.onSubmitBoundary();
    if (!gate.proceed) return { boundaryReached: false, submitTriggered: false, confirmed: false };
    clicks.n += 1;
    if (mode === "timeout") throw new Error("confirmation timeout");
    return { boundaryReached: true, submitTriggered: true, confirmed: true, confirmationEvidence: "local-success-page", providerReference: "headed-local" };
  };
}

async function cleanup(userId: string) {
  await prisma.application.updateMany({ where: { userId }, data: { submittedPackageId: null, submittedExecutionAttemptId: null } });
  await prisma.applicationSubmissionAttempt.deleteMany({ where: { userId } });
  await prisma.applicationExecutionEvent.deleteMany({ where: { userId } });
  await prisma.applicationExecutionSession.deleteMany({ where: { userId } });
  await prisma.applicationEvent.deleteMany({ where: { userId } });
  await prisma.applicationPackage.deleteMany({ where: { userId } });
  await prisma.application.deleteMany({ where: { userId } });
  await prisma.resumeVersion.updateMany({ where: { userId }, data: { activeRevisionId: null } });
  await prisma.resumeVersionRevision.deleteMany({ where: { userId } });
  await prisma.resumeVersion.deleteMany({ where: { userId } });
  await prisma.opportunityAnalysisSnapshot.deleteMany({ where: { userId } });
  await prisma.resumeAnalysis.deleteMany({ where: { resumeDocument: { userId } } });
  await prisma.resumeSourceRevision.deleteMany({ where: { userId } });
  await prisma.resumeDocument.deleteMany({ where: { userId } });
  await prisma.jobPosting.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|Failed to load resource/i.test(text)) return;
    problems.push(text);
  });
  return problems;
}

async function run() {
  const fixture = await startFixtureServer();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = watch(page);
  let userId: string | null = null;
  try {
    await page.goto(`${fixture.origin}/generic?variant=actions`, { waitUntil: "domcontentloaded" });
    const submit = page.locator("[data-careeros-final-submit]");
    await submit.waitFor();
    assert((await submit.innerText()).includes("Submit application"), "final control is not an explicit submit");
    const submitCount = await page.locator("button[type=submit]").count();
    assert(submitCount === 1, `expected one submit button, found ${submitCount}`);
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    assert(await continueButton.getAttribute("type") !== "submit", "Continue is a submit control");
    const saveButton = page.getByRole("button", { name: "Save & Continue" });
    assert(await saveButton.getAttribute("type") !== "submit", "Save is a submit control");

    const email = `m32-headed-${Date.now()}@careeros.local`;
    const signup = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email, password: "Milestone32Test!", name: "M32 Headed" },
    });
    if (!signup.ok()) throw new Error(`Sign-up failed: ${signup.status()} ${await signup.text()}`);
    const body = await signup.json() as { user?: { id?: string } };
    userId = body.user?.id ?? null;
    if (!userId) throw new Error("Sign-up did not return a user id");
    const seeded = await seedReadyPackage(userId);

    await page.goto(`${BASE}/workspace/jobs/apply-now/${seeded.packageId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("This is the package that will be submitted.").waitFor({ timeout: 30000 });
    await page.getByText("Application readiness READY").waitFor();
    await page.getByText("Source CV cv.pdf · Revision 1").waitFor();
    await page.getByText("Tailored resume revision 1").waitFor();
    const issue = page.getByText("1 Issue", { exact: true });
    assert(await issue.count() === 0, "Next.js issue badge was visible");

    const documentB = await prisma.resumeDocument.create({
      data: { userId, filename: "cv-b.pdf", mimeType: "application/pdf", fileSize: 8, textLength: 8, textPreview: "b" },
    });
    const revisionB = await prisma.resumeSourceRevision.create({
      data: {
        userId,
        resumeDocumentId: documentB.id,
        revisionNumber: 2,
        contentHash: "e".repeat(64),
        sourceFilename: "cv-b.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: seeded.revisionId }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Package outdated").waitFor({ timeout: 30000 });
    await page.getByText("Application readiness BLOCKED").waitFor();
    assert(await page.getByRole("button", { name: "Submit This Application Now" }).count() === 0, "stale package offered submit");

    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: seeded.revisionId }, data: { isActive: true } });
    const happy = await seedAnotherPackage(userId, seeded);
    const clicks = { n: 0 };
    const acquired = await acquirePackageExecution(userId, happy.packageId);
    assert(acquired.outcome === "ACQUIRED" && acquired.attemptId && acquired.applicationId && acquired.sessionId, acquired.outcome);
    const confirmed = await executeControlledSubmit(userId, acquired.attemptId, provider("success", clicks));
    assert(confirmed.domain === "SUBMITTED_CONFIRMED" && clicks.n === 1, confirmed.domain);

    await page.goto(`${BASE}/workspace/applications/${acquired.applicationId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Applied", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByText("Revision 1").first().waitFor();
    const appliedLine = await page.locator("p", { hasText: "Applied " }).first().innerText();
    assert(!appliedLine.includes("Applied —"), appliedLine);

    await page.goto(`${BASE}/workspace/jobs/apply-now/${happy.packageId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Source CV cv.pdf · Revision 1").waitFor({ timeout: 30000 });
    await page.getByText("Tailored resume revision 1").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Source CV cv.pdf · Revision 1").waitFor({ timeout: 30000 });
    const submittedEvents = await prisma.applicationEvent.count({ where: { applicationId: acquired.applicationId, type: "SUBMITTED" } });
    assert(submittedEvents === 1 && clicks.n === 1, `refresh duplicated state events=${submittedEvents} clicks=${clicks.n}`);

    await page.goto(`${BASE}/workspace/jobs/apply-now/executions/${acquired.sessionId}`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    const replay = await executeControlledSubmit(userId, acquired.attemptId, provider("success", clicks));
    assert(replay.providerInvoked === false && clicks.n === 1, "headed replay contacted the provider");
    const afterReplay = await prisma.applicationEvent.count({ where: { applicationId: acquired.applicationId, type: "SUBMITTED" } });
    assert(afterReplay === 1, `headed replay events ${afterReplay}`);

    const uncertainPackage = await seedAnotherPackage(userId, seeded);
    const uncertain = await acquirePackageExecution(userId, uncertainPackage.packageId);
    assert(uncertain.attemptId && uncertain.applicationId && uncertain.sessionId, uncertain.outcome);
    const uncertainClicks = { n: 0 };
    const lost = await executeControlledSubmit(userId, uncertain.attemptId, provider("timeout", uncertainClicks));
    assert(lost.domain === "SUBMIT_UNCERTAIN" && uncertainClicks.n === 1, lost.domain);
    await page.goto(`${BASE}/workspace/jobs/apply-now/executions/${uncertain.sessionId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Submission status uncertain.").waitFor({ timeout: 30000 });
    const uncertainApplication = await prisma.application.findUniqueOrThrow({ where: { id: uncertain.applicationId } });
    assert(uncertainApplication.status === "DRAFT", "uncertain UI marked APPLIED");
    const retry = await executeControlledSubmit(userId, uncertain.attemptId, provider("success", uncertainClicks));
    assert(retry.providerInvoked === false && uncertainClicks.n === 1, "uncertain UI retried the provider");

    const recoveryPackage = await seedAnotherPackage(userId, seeded);
    const recovery = await acquirePackageExecution(userId, recoveryPackage.packageId);
    assert(recovery.attemptId && recovery.applicationId, recovery.outcome);
    const recoveryClicks = { n: 0 };
    await prisma.applicationSubmissionAttempt.update({
      where: { id: recovery.attemptId },
      data: { status: "SUBMITTING", submitBoundaryCrossedAt: new Date() },
    });
    const persisted = await persistTrustedConfirmation(userId, recovery.attemptId, {
      confirmationType: "provider-confirmation",
      confirmationEvidence: "local-success-page",
    });
    assert(persisted, "headed recovery did not persist confirmation");
    const reconciled = await reconcileConfirmedSubmission(userId, recovery.attemptId);
    assert(reconciled === "FINALIZED" && recoveryClicks.n === 0, reconciled);
    await page.goto(`${BASE}/workspace/applications/${recovery.applicationId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Applied", { exact: true }).waitFor({ timeout: 30000 });

    const hydration = problems.filter((item) => /hydration|did not match/i.test(item));
    if (hydration.length > 0) throw new Error(hydration.join("\n"));
    const career = problems.filter((item) => /careeros|application readiness|unhandled/i.test(item));
    if (career.length > 0) throw new Error(career.join("\n"));
    console.log("m32:headed PASS");
  } finally {
    await browser.close();
    await fixture.close();
    if (userId) await cleanup(userId).catch(() => undefined);
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
