import "dotenv/config";

import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import { assertDomainTransition, canTransitionDomain } from "@/features/application-execution/integrity/execution-domain";
import {
  abortBeforeSubmit,
  acquirePackageExecution,
  confirmTrackedSubmission,
  executeControlledSubmit,
  resolveUncertainSubmission,
} from "@/features/application-execution/integrity/run-package-execution";
import type { ProviderExecutionResult } from "@/features/application-execution/integrity/execution-domain";
import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function seed() {
  const stamp = `${Date.now()}-m323`;
  const user = await prisma.user.create({ data: { name: "m323", email: `m32-3-${stamp}@careeros.local` } });
  const document = await prisma.resumeDocument.create({
    data: { userId: user.id, filename: "cv.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 40, textPreview: "preview" },
  });
  const hash = "a".repeat(64);
  const revision = await prisma.resumeSourceRevision.create({
    data: { userId: user.id, resumeDocumentId: document.id, revisionNumber: 1, contentHash: hash, sourceFilename: "cv.pdf", isActive: true },
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
    data: { userId: user.id, title: "Backend Engineer", company: "CareerOS QA", location: "Istanbul", description },
  });
  await prisma.opportunityAnalysisSnapshot.create({
    data: {
      userId: user.id,
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
    data: { userId: user.id, targetJobId: job.id, title: "Tailored", status: "READY" },
  });
  const tailored = await prisma.resumeVersionRevision.create({
    data: {
      resumeVersionId: version.id,
      userId: user.id,
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
  const built = await buildSubmissionPackage(user.id, job.id, {
    tailoredResumeVersionId: version.id,
    tailoredResumeRevisionId: tailored.id,
  });
  assert(built.readiness.status === "READY", built.readiness.blockers.join(","));
  return { user, document, revision, analysis, job, version, tailored, packageId: built.packageId, packageHash: built.packageHash };
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
  await prisma.user.delete({ where: { id: userId } });
}

type Mode = "success" | "reject" | "timeout" | "crash" | "missing" | "selector" | "form" | "before-browser";

function provider(mode: Mode, clicks: { n: number }) {
  return async (hooks: { onSubmitBoundary: () => Promise<{ proceed: boolean }> }): Promise<ProviderExecutionResult> => {
    if (mode === "before-browser" || mode === "form" || mode === "missing" || mode === "selector") {
      const code = mode === "missing" ? "MISSING_FIELD" : mode === "selector" ? "SELECTOR_CHANGED" : mode === "form" ? "FORM_UNAVAILABLE" : "FORM_UNAVAILABLE";
      return { boundaryReached: false, submitTriggered: false, confirmed: false, failure: { code, phase: "BEFORE_SUBMIT" } };
    }
    const gate = await hooks.onSubmitBoundary();
    if (!gate.proceed) {
      return { boundaryReached: false, submitTriggered: false, confirmed: false };
    }
    clicks.n += 1;
    if (mode === "timeout" || mode === "crash") throw new Error(mode);
    if (mode === "reject") {
      return { boundaryReached: true, submitTriggered: true, confirmed: false, failure: { code: "SUBMISSION_REJECTED", phase: "AFTER_SUBMIT" } };
    }
    return {
      boundaryReached: true,
      submitTriggered: true,
      confirmed: true,
      confirmationEvidence: "local-success-page",
      providerReference: "qa-local-1",
    };
  };
}

async function main() {
  assert(canTransitionDomain("PREPARED", "AWAITING_USER_REVIEW"), "prepared to review");
  assert(canTransitionDomain("AWAITING_USER_REVIEW", "READY_TO_EXECUTE"), "review to ready");
  assert(canTransitionDomain("READY_TO_EXECUTE", "EXECUTING"), "ready to executing");
  assert(canTransitionDomain("EXECUTING", "FILLING_FORM"), "executing to filling");
  assert(canTransitionDomain("FILLING_FORM", "READY_AT_SUBMIT_BOUNDARY"), "filling to boundary");
  assert(canTransitionDomain("READY_AT_SUBMIT_BOUNDARY", "SUBMITTING"), "boundary to submitting");
  assert(canTransitionDomain("SUBMITTING", "SUBMITTED_CONFIRMED"), "submitting to confirmed");
  assert(canTransitionDomain("SUBMITTING", "SUBMIT_UNCERTAIN"), "submitting to uncertain");
  assert(canTransitionDomain("EXECUTING", "FAILED_BEFORE_SUBMIT"), "pre-submit failure");
  assert(!canTransitionDomain("SUBMITTED_CONFIRMED", "SUBMITTING"), "confirmed resubmit was legal");
  let illegal = false;
  try {
    assertDomainTransition("SUBMITTED_CONFIRMED", "SUBMITTING");
  } catch {
    illegal = true;
  }
  assert(illegal, "illegal transition was not rejected");

  const fixture = await seed();
  try {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.outcome === "ACQUIRED" && acquired.attemptId && acquired.applicationId, acquired.outcome);

    const replay = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(replay.outcome === "ALREADY_EXECUTING" && replay.attemptId === acquired.attemptId, replay.outcome);

    const parallel = await Promise.all([
      acquirePackageExecution(fixture.user.id, fixture.packageId),
      acquirePackageExecution(fixture.user.id, fixture.packageId),
    ]);
    assert(parallel.every((item) => item.attemptId === acquired.attemptId), "parallel acquire created a second attempt");

    const clicks = { n: 0 };
    const first = executeControlledSubmit(fixture.user.id, acquired.attemptId, provider("success", clicks));
    const second = executeControlledSubmit(fixture.user.id, acquired.attemptId, provider("success", clicks));
    const raced = await Promise.all([first, second]);
    assert(clicks.n === 1, `double submit clicked ${clicks.n} times`);
    assert(raced.some((item) => item.domain === "SUBMITTED_CONFIRMED"), "neither submit confirmed");

    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "APPLIED", application.status);
    assert(application.submittedPackageId === fixture.packageId, "tracker is not bound to the package");
    assert(application.submittedExecutionAttemptId === acquired.attemptId, "tracker is not bound to the attempt");
    assert(application.resumeVersionRevisionId === fixture.tailored.id, "tailored revision was not locked");
    const submittedEvents = await prisma.applicationEvent.count({
      where: { applicationId: application.id, type: "SUBMITTED" },
    });
    assert(submittedEvents === 1, `expected one submission event, found ${submittedEvents}`);
    const finalizedPackage = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
    const finalizedAttempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: acquired.attemptId } });
    const finalizedSession = await prisma.applicationExecutionSession.findUniqueOrThrow({ where: { id: acquired.sessionId! } });
    const terminalEvents = await prisma.applicationExecutionEvent.count({
      where: { executionSessionId: acquired.sessionId!, type: "SESSION_COMPLETED" },
    });
    assert(finalizedPackage.status === "SUBMITTED", "atomic finalizer did not submit the package");
    assert(finalizedAttempt.status === "COMPLETED" && finalizedAttempt.verificationStatus === "VERIFIED", "atomic finalizer did not verify the attempt");
    assert(finalizedSession.status === "SUBMITTED", "atomic finalizer did not submit the session");
    assert(terminalEvents === 1, `expected one terminal execution event, found ${terminalEvents}`);

    await confirmTrackedSubmission(fixture.user.id, acquired.attemptId, "qa-local-1", "local-success-page");
    const submittedAgain = await prisma.applicationEvent.count({
      where: { applicationId: application.id, type: "SUBMITTED" },
    });
    assert(submittedAgain === 1, "reprocessing confirmation duplicated the timeline event");

    const again = await executeControlledSubmit(fixture.user.id, acquired.attemptId, provider("success", clicks));
    assert(again.providerInvoked === false && again.domain === "SUBMITTED_CONFIRMED", "confirmed replay touched the provider");
    assert(clicks.n === 1, "confirmed replay clicked submit");

    const stored = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
    const documentB = await prisma.resumeDocument.create({
      data: { userId: fixture.user.id, filename: "cv-b.pdf", mimeType: "application/pdf", fileSize: 8, textLength: 8, textPreview: "b" },
    });
    const revisionB = await prisma.resumeSourceRevision.create({
      data: {
        userId: fixture.user.id,
        resumeDocumentId: documentB.id,
        revisionNumber: 2,
        contentHash: "b".repeat(64),
        sourceFilename: "cv-b.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    const after = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    const packAfter = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
    assert(after.submittedPackageId === stored.id, "historical package link changed");
    assert(after.submittedExecutionAttemptId === acquired.attemptId, "historical attempt changed");
    assert(packAfter.packageHash === stored.packageHash, "historical package hash changed");
    assert(packAfter.sourceResumeRevisionId === fixture.revision.id, "historical source revision changed");
    assert(packAfter.resumeVersionRevisionId === fixture.tailored.id, "historical tailored revision changed");

    const other = await prisma.user.create({ data: { name: "other", email: `m32-3-other-${Date.now()}@careeros.local` } });
    const denied = await acquirePackageExecution(other.id, fixture.packageId);
    assert(denied.outcome === "BLOCKED", "cross-user acquire was allowed");
    await prisma.user.delete({ where: { id: other.id } });
  } finally {
    await cleanup(fixture.user.id);
  }

  const uncertain = await seed();
  try {
    const acquired = await acquirePackageExecution(uncertain.user.id, uncertain.packageId);
    assert(acquired.attemptId && acquired.applicationId, "uncertain fixture did not acquire");
    const clicks = { n: 0 };
    const result = await executeControlledSubmit(uncertain.user.id, acquired.attemptId, provider("timeout", clicks));
    assert(result.domain === "SUBMIT_UNCERTAIN", result.domain);
    assert(clicks.n === 1, "timeout did not reach the click");
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "uncertain submission marked APPLIED");
    const retry = await executeControlledSubmit(uncertain.user.id, acquired.attemptId, provider("success", clicks));
    assert(retry.providerInvoked === false && clicks.n === 1, "uncertain submission retried automatically");
    const resolved = await resolveUncertainSubmission(uncertain.user.id, acquired.attemptId, true);
    assert(resolved === "SUBMITTED_CONFIRMED", resolved);
    const events = await prisma.applicationExecutionEvent.findMany({
      where: { executionSessionId: acquired.sessionId! },
      select: { message: true },
    });
    assert(events.some((event) => event.message.includes("uncertain")), "uncertainty history was erased");
    const applied = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(applied.status === "APPLIED", "manual confirmation did not mark APPLIED");
  } finally {
    await cleanup(uncertain.user.id);
  }

  for (const mode of ["before-browser", "form", "missing", "selector"] as const) {
    const fixtureMode = await seed();
    try {
      const acquired = await acquirePackageExecution(fixtureMode.user.id, fixtureMode.packageId);
      assert(acquired.attemptId && acquired.applicationId, mode);
      const clicks = { n: 0 };
      const result = await executeControlledSubmit(fixtureMode.user.id, acquired.attemptId, provider(mode, clicks));
      assert(result.domain === "FAILED_BEFORE_SUBMIT", `${mode} became ${result.domain}`);
      assert(clicks.n === 0, `${mode} clicked submit`);
      const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
      assert(application.status === "DRAFT", `${mode} marked APPLIED`);
      const retry = await acquirePackageExecution(fixtureMode.user.id, fixtureMode.packageId);
      assert(retry.outcome === "ACQUIRED", `${mode} could not be retried`);
    } finally {
      await cleanup(fixtureMode.user.id);
    }
  }

  const rejected = await seed();
  try {
    const acquired = await acquirePackageExecution(rejected.user.id, rejected.packageId);
    assert(acquired.attemptId, "reject fixture");
    const clicks = { n: 0 };
    const result = await executeControlledSubmit(rejected.user.id, acquired.attemptId!, provider("reject", clicks));
    assert(result.domain === "FAILED_AFTER_SUBMIT_ATTEMPT", result.domain);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId! } });
    assert(application.status === "DRAFT", "provider rejection marked APPLIED");
    const retry = await acquirePackageExecution(rejected.user.id, rejected.packageId);
    assert(retry.outcome === "REJECTED_NO_RETRY", retry.outcome);
  } finally {
    await cleanup(rejected.user.id);
  }

  const aborted = await seed();
  try {
    const acquired = await acquirePackageExecution(aborted.user.id, aborted.packageId);
    assert(acquired.attemptId && acquired.applicationId, "abort fixture");
    await abortBeforeSubmit(aborted.user.id, acquired.attemptId);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "abort marked APPLIED");
    const attempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: acquired.attemptId } });
    assert(attempt.status === "CANCELLED" && attempt.submitBoundaryCrossedAt === null, "abort looked like an uncertain submit");
  } finally {
    await cleanup(aborted.user.id);
  }

  console.log("m32-3:qa PASS");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
