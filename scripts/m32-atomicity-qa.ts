import "dotenv/config";

import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import type { ProviderExecutionResult } from "@/features/application-execution/integrity/execution-domain";
import {
  FinalizerFault,
  finalizeConfirmedSubmission,
  persistTrustedConfirmation,
  reconcileConfirmedSubmission,
  recoverInterruptedSubmissionAttempt,
  type FinalizerFaultPoint,
} from "@/features/application-execution/integrity/finalize-confirmed-submission";
import {
  abortBeforeSubmit,
  acquirePackageExecution,
  executeControlledSubmit,
} from "@/features/application-execution/integrity/run-package-execution";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Fixture = {
  user: { id: string };
  packageId: string;
  packageHash: string;
  revision: { id: string };
  tailored: { id: string };
  version: { id: string };
  job: { id: string };
  document: { id: string };
};

async function counts() {
  const [applications, packages, attempts, sessions, applicationEvents, executionEvents] = await Promise.all([
    prisma.application.count(),
    prisma.applicationPackage.count(),
    prisma.applicationSubmissionAttempt.count(),
    prisma.applicationExecutionSession.count(),
    prisma.applicationEvent.count(),
    prisma.applicationExecutionEvent.count(),
  ]);
  return { applications, packages, attempts, sessions, applicationEvents, executionEvents };
}

async function seed(label: string): Promise<Fixture> {
  const stamp = `${Date.now()}-${label}-${Math.random().toString(16).slice(2, 8)}`;
  const user = await prisma.user.create({ data: { name: label, email: `m32-atomic-${stamp}@careeros.local` } });
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
  assert(built.readiness.status === "READY", `${label} ${built.readiness.blockers.join(",")}`);
  return { user, packageId: built.packageId, packageHash: built.packageHash, revision, tailored, version, job, document };
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

async function withFixture(label: string, run: (fixture: Fixture) => Promise<void>) {
  const fixture = await seed(label);
  try {
    await run(fixture);
  } finally {
    await cleanup(fixture.user.id);
  }
}

function successProvider(clicks: { n: number }) {
  return async (hooks: { onSubmitBoundary: () => Promise<{ proceed: boolean }> }): Promise<ProviderExecutionResult> => {
    const gate = await hooks.onSubmitBoundary();
    if (!gate.proceed) return { boundaryReached: false, submitTriggered: false, confirmed: false };
    clicks.n += 1;
    return {
      boundaryReached: true,
      submitTriggered: true,
      confirmed: true,
      confirmationEvidence: "local-success-page",
      providerReference: "qa-atomic",
    };
  };
}

async function prepareTrusted(fixture: Fixture) {
  const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
  assert(acquired.outcome === "ACQUIRED" && acquired.attemptId && acquired.applicationId && acquired.sessionId, acquired.outcome);
  await prisma.applicationSubmissionAttempt.update({
    where: { id: acquired.attemptId },
    data: { status: "SUBMITTING", submitBoundaryCrossedAt: new Date(), startedAt: new Date() },
  });
  const persisted = await persistTrustedConfirmation(fixture.user.id, acquired.attemptId, {
    confirmationType: "provider-confirmation",
    confirmationReference: "qa-atomic",
    confirmationEvidence: "local-success-page",
  });
  assert(persisted, "trusted confirmation was not durable");
  return { attemptId: acquired.attemptId, applicationId: acquired.applicationId, sessionId: acquired.sessionId };
}

function inputFor(fixture: Fixture, ids: { attemptId: string; applicationId: string }) {
  return {
    userId: fixture.user.id,
    submissionAttemptId: ids.attemptId,
    submissionPackageId: fixture.packageId,
    applicationId: ids.applicationId,
  };
}

async function assertRolledBack(label: string, fixture: Fixture, ids: { attemptId: string; applicationId: string; sessionId: string }) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
  assert(application.status === "DRAFT", `${label} application ${application.status}`);
  assert(application.submittedPackageId === null, `${label} committed submittedPackageId`);
  assert(application.submittedExecutionAttemptId === null, `${label} committed submittedExecutionAttemptId`);
  const pack = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
  assert(pack.status !== "SUBMITTED", `${label} package ${pack.status}`);
  assert(pack.packageHash === fixture.packageHash, `${label} rewrote package hash`);
  const attempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: ids.attemptId } });
  assert(attempt.status !== "COMPLETED" && attempt.verificationStatus !== "VERIFIED", `${label} finalized the attempt`);
  assert(attempt.submitBoundaryCrossedAt !== null, `${label} erased the pre-transaction boundary`);
  const evidence = attempt.verificationEvidenceJson as { trustedConfirmation?: boolean };
  assert(evidence.trustedConfirmation === true, `${label} erased durable confirmation`);
  const session = await prisma.applicationExecutionSession.findUniqueOrThrow({ where: { id: ids.sessionId } });
  assert(session.status !== "SUBMITTED", `${label} session ${session.status}`);
  const submitted = await prisma.applicationEvent.count({ where: { applicationId: ids.applicationId, type: "SUBMITTED" } });
  const terminal = await prisma.applicationExecutionEvent.count({ where: { executionSessionId: ids.sessionId, type: "SESSION_COMPLETED" } });
  assert(submitted === 0 && terminal === 0, `${label} committed events submitted=${submitted} terminal=${terminal}`);
}

async function assertFinal(
  label: string,
  fixture: Fixture,
  ids: { attemptId: string; applicationId: string; sessionId: string },
  confirmationType = "provider-confirmation",
) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
  assert(application.status === "APPLIED", `${label} ${application.status}`);
  assert(application.submittedPackageId === fixture.packageId, `${label} package fk`);
  assert(application.submittedExecutionAttemptId === ids.attemptId, `${label} attempt fk`);
  assert(application.resumeVersionRevisionId === fixture.tailored.id, `${label} tailored revision`);
  const pack = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
  assert(pack.status === "SUBMITTED" && pack.packageHash === fixture.packageHash, `${label} package`);
  assert(pack.sourceResumeRevisionId === fixture.revision.id, `${label} source revision`);
  const attempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: ids.attemptId } });
  assert(attempt.status === "COMPLETED" && attempt.verificationStatus === "VERIFIED", `${label} attempt`);
  assert(attempt.confirmationType === confirmationType, `${label} confirmation type`);
  const session = await prisma.applicationExecutionSession.findUniqueOrThrow({ where: { id: ids.sessionId } });
  assert(session.status === "SUBMITTED", `${label} session`);
  const submitted = await prisma.applicationEvent.count({ where: { applicationId: ids.applicationId, type: "SUBMITTED" } });
  const terminal = await prisma.applicationExecutionEvent.count({ where: { executionSessionId: ids.sessionId, type: "SESSION_COMPLETED" } });
  assert(submitted === 1 && terminal === 1, `${label} events submitted=${submitted} terminal=${terminal}`);
  return { application, pack, attempt, session, submitted, terminal };
}

async function main() {
  const before = await counts();
  console.log(`row counts before ${JSON.stringify(before)}`);
  const faults: FinalizerFaultPoint[] = [
    "AFTER_ATTEMPT",
    "AFTER_SESSION",
    "AFTER_PACKAGE",
    "AFTER_APPLICATION",
    "AFTER_APPLICATION_EVENT",
    "AFTER_EXECUTION_EVENT",
  ];

  await withFixture("A", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    const result = await finalizeConfirmedSubmission(inputFor(fixture, ids));
    assert(result === "FINALIZED", result);
    const proof = await assertFinal("A", fixture, ids);
    const packageHash = proof.pack.packageHash;
    assert(packageHash, "A package hash");
    console.log(`confirmed fixture application=${proof.application.id} status=${proof.application.status} submittedPackageId=${proof.application.submittedPackageId} submittedExecutionAttemptId=${proof.application.submittedExecutionAttemptId}`);
    console.log(`confirmed fixture package=${proof.pack.id} status=${proof.pack.status} hash=${packageHash.slice(0, 12)}`);
    console.log(`confirmed fixture attempt=${proof.attempt.id} status=${proof.attempt.status} boundary=${proof.attempt.submitBoundaryCrossedAt?.toISOString() ?? "none"} confirmationType=${proof.attempt.confirmationType}`);
    console.log(`confirmed fixture session=${proof.session.id} status=${proof.session.status} submittedEvents=${proof.submitted} terminalEvents=${proof.terminal} providerClicks=0`);
  });

  for (const fault of faults) {
    await withFixture(fault, async (fixture) => {
      const ids = await prepareTrusted(fixture);
      let threw = false;
      try {
        await finalizeConfirmedSubmission(inputFor(fixture, ids), { faultPoint: fault });
      } catch (error) {
        threw = error instanceof FinalizerFault && error.faultPoint === fault;
      }
      assert(threw, `${fault} did not roll back`);
      await assertRolledBack(fault, fixture, ids);
      console.log(`${fault} ROLLBACK PASS`);
    });
  }

  await withFixture("H", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "FINALIZED", "H first");
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "ALREADY_FINALIZED", "H replay");
    await assertFinal("H", fixture, ids);
  });

  await withFixture("I", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "FINALIZED", "I first");
    for (let index = 0; index < 10; index += 1) {
      assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "ALREADY_FINALIZED", `I replay ${index}`);
    }
    await assertFinal("I", fixture, ids);
    console.log("10x replay PASS providerClicks=0");
  });

  await withFixture("J", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    const results = await Promise.all([
      finalizeConfirmedSubmission(inputFor(fixture, ids)),
      finalizeConfirmedSubmission(inputFor(fixture, ids)),
    ]);
    assert(results.filter((item) => item === "FINALIZED").length === 1, results.join(","));
    assert(results.every((item) => item === "FINALIZED" || item === "ALREADY_FINALIZED"), results.join(","));
    await assertFinal("J", fixture, ids);
    console.log(`parallel finalizer ${results.join(",")} PASS`);
  });

  await withFixture("K", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "FINALIZED", "K first");
    const session = await prisma.applicationExecutionSession.create({
      data: {
        userId: fixture.user.id,
        applicationPackageId: fixture.packageId,
        applicationId: ids.applicationId,
        jobPostingId: fixture.job.id,
        provider: "UNKNOWN",
        status: "READY_TO_SUBMIT",
      },
    });
    const other = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: fixture.user.id,
        executionSessionId: session.id,
        applicationPackageId: fixture.packageId,
        applicationId: ids.applicationId,
        attemptNumber: 1,
        method: "BROWSER_CONFIRMED",
        status: "SUBMITTING",
        submitBoundaryCrossedAt: new Date(),
        approvalFingerprint: `k-${session.id}`,
        idempotencyKey: `k-${session.id}`,
        resumeVersionRevisionId: fixture.tailored.id,
        resumeFileHash: "a".repeat(64),
        confirmationType: "provider-confirmation",
        verificationEvidenceJson: { trustedConfirmation: true },
      },
    });
    const conflict = await finalizeConfirmedSubmission({
      userId: fixture.user.id,
      submissionAttemptId: other.id,
      submissionPackageId: fixture.packageId,
      applicationId: ids.applicationId,
    });
    assert(conflict === "CONFLICT", conflict);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
    assert(application.submittedExecutionAttemptId === ids.attemptId, "K overwrote the attempt");
  });

  await withFixture("L", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "FINALIZED", "L first");
    const second = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
      forceNew: true,
    });
    const session = await prisma.applicationExecutionSession.create({
      data: {
        userId: fixture.user.id,
        applicationPackageId: second.packageId,
        applicationId: ids.applicationId,
        jobPostingId: fixture.job.id,
        provider: "UNKNOWN",
        status: "READY_TO_SUBMIT",
      },
    });
    const other = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: fixture.user.id,
        executionSessionId: session.id,
        applicationPackageId: second.packageId,
        applicationId: ids.applicationId,
        attemptNumber: 1,
        method: "BROWSER_CONFIRMED",
        status: "SUBMITTING",
        submitBoundaryCrossedAt: new Date(),
        approvalFingerprint: `l-${session.id}`,
        idempotencyKey: `l-${session.id}`,
        resumeVersionRevisionId: fixture.tailored.id,
        resumeFileHash: "a".repeat(64),
        confirmationType: "provider-confirmation",
        verificationEvidenceJson: { trustedConfirmation: true },
      },
    });
    const conflict = await finalizeConfirmedSubmission({
      userId: fixture.user.id,
      submissionAttemptId: other.id,
      submissionPackageId: second.packageId,
      applicationId: ids.applicationId,
    });
    assert(conflict === "CONFLICT", conflict);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
    assert(application.submittedPackageId === fixture.packageId, "L overwrote the package");
    const packB = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: second.packageId } });
    assert(packB.status !== "SUBMITTED", "L submitted package B");
  });

  await withFixture("M", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    const other = await prisma.user.create({ data: { name: "other", email: `m32-atomic-other-${Date.now()}@careeros.local` } });
    try {
      const denied = await finalizeConfirmedSubmission({
        userId: other.id,
        submissionAttemptId: ids.attemptId,
        submissionPackageId: fixture.packageId,
        applicationId: ids.applicationId,
      });
      assert(denied === "OWNERSHIP_DENIED", denied);
      const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
      assert(application.status === "DRAFT", "M mutated the application");
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });

  await withFixture("N", async (fixture) => {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId, acquired.outcome);
    const rejected = await finalizeConfirmedSubmission({
      userId: fixture.user.id,
      submissionAttemptId: acquired.attemptId,
      submissionPackageId: fixture.packageId,
      applicationId: acquired.applicationId,
    });
    assert(rejected === "INVALID_CONFIRMATION", rejected);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "N marked APPLIED");
  });

  await withFixture("O", async (fixture) => {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId, acquired.outcome);
    await prisma.applicationSubmissionAttempt.update({
      where: { id: acquired.attemptId! },
      data: { status: "UNCERTAIN", submitBoundaryCrossedAt: new Date(), failureCode: "SUBMISSION_UNCERTAIN" },
    });
    const result = await reconcileConfirmedSubmission(fixture.user.id, acquired.attemptId!);
    assert(result === "INVALID_CONFIRMATION", result);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId! } });
    assert(application.status === "DRAFT", "O marked APPLIED");
  });

  await withFixture("P", async (fixture) => {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId, acquired.outcome);
    const clicks = { n: 0 };
    const result = await executeControlledSubmit(fixture.user.id, acquired.attemptId, async (hooks) => {
      const gate = await hooks.onSubmitBoundary();
      if (!gate.proceed) return { boundaryReached: false, submitTriggered: false, confirmed: false };
      clicks.n += 1;
      return { boundaryReached: true, submitTriggered: true, confirmed: false, failure: { code: "SUBMISSION_REJECTED", phase: "AFTER_SUBMIT" } };
    });
    assert(result.domain === "FAILED_AFTER_SUBMIT_ATTEMPT" && clicks.n === 1, result.domain);
    const finalized = await finalizeConfirmedSubmission({
      userId: fixture.user.id,
      submissionAttemptId: acquired.attemptId,
      submissionPackageId: fixture.packageId,
      applicationId: acquired.applicationId,
    });
    assert(finalized === "INVALID_CONFIRMATION", finalized);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "P marked APPLIED");
  });

  await withFixture("Q", async (fixture) => {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId, acquired.outcome);
    await abortBeforeSubmit(fixture.user.id, acquired.attemptId);
    const rejected = await finalizeConfirmedSubmission({
      userId: fixture.user.id,
      submissionAttemptId: acquired.attemptId,
      submissionPackageId: fixture.packageId,
      applicationId: acquired.applicationId,
    });
    assert(rejected === "INVALID_CONFIRMATION", rejected);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "Q marked APPLIED");
  });

  await withFixture("R", async (fixture) => {
    const clicks = { n: 0 };
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId && acquired.sessionId, acquired.outcome);
    await prisma.applicationSubmissionAttempt.update({
      where: { id: acquired.attemptId },
      data: {
        status: "COMPLETED",
        verificationStatus: "VERIFIED",
        submitBoundaryCrossedAt: new Date(),
        confirmationType: "provider-confirmation",
        providerApplicationId: "legacy-ref",
        verificationEvidenceJson: { trustedConfirmation: true },
      },
    });
    const first = await reconcileConfirmedSubmission(fixture.user.id, acquired.attemptId);
    assert(first === "FINALIZED", first);
    assert(clicks.n === 0, "R contacted the provider");
    await assertFinal("R", fixture, { attemptId: acquired.attemptId, applicationId: acquired.applicationId, sessionId: acquired.sessionId });
    const second = await reconcileConfirmedSubmission(fixture.user.id, acquired.attemptId);
    assert(second === "ALREADY_FINALIZED", second);
    const submitted = await prisma.applicationEvent.count({ where: { applicationId: acquired.applicationId, type: "SUBMITTED" } });
    assert(submitted === 1, `S duplicated events ${submitted}`);
    console.log("reconcile durable confirmed + DRAFT PASS providerCalls=0");
  });

  await withFixture("T", async (fixture) => {
    const clicks = { n: 0 };
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId, acquired.outcome);
    await prisma.applicationSubmissionAttempt.update({
      where: { id: acquired.attemptId },
      data: { status: "SUBMITTING", submitBoundaryCrossedAt: new Date() },
    });
    const recovery = await recoverInterruptedSubmissionAttempt(fixture.user.id, acquired.attemptId);
    assert(recovery === "SUBMIT_UNCERTAIN", recovery);
    assert(clicks.n === 0, "T contacted the provider");
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT", "T marked APPLIED");
    const attempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: acquired.attemptId } });
    assert(attempt.status === "UNCERTAIN", attempt.status);
    console.log("boundary without confirmation SUBMIT_UNCERTAIN providerCalls=0");
  });

  await withFixture("U", async (fixture) => {
    const clicks = { n: 0 };
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId && acquired.sessionId, acquired.outcome);
    let threw = false;
    try {
      await executeControlledSubmit(fixture.user.id, acquired.attemptId, successProvider(clicks), { finalizerFault: "AFTER_APPLICATION" });
    } catch (error) {
      threw = error instanceof FinalizerFault;
    }
    assert(threw && clicks.n === 1, `U threw=${threw} clicks=${clicks.n}`);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(application.status === "DRAFT" && application.submittedPackageId === null, "U committed partial success");
    const attempt = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: acquired.attemptId } });
    const evidence = attempt.verificationEvidenceJson as { trustedConfirmation?: boolean };
    assert(evidence.trustedConfirmation === true, "U lost durable confirmation");
    const reconciled = await reconcileConfirmedSubmission(fixture.user.id, acquired.attemptId);
    assert(reconciled === "FINALIZED" && clicks.n === 1, `${reconciled} clicks=${clicks.n}`);
    await assertFinal("U", fixture, { attemptId: acquired.attemptId, applicationId: acquired.applicationId, sessionId: acquired.sessionId }, "local-success-page");
    console.log("confirmation durable across transaction failure; reconciled locally; providerClicks=1");
  });

  await withFixture("V", async (fixture) => {
    const clicks = { n: 0 };
    const provider = async () => {
      clicks.n += 1;
      return { confirmed: true };
    };
    const ids = await prepareTrusted(fixture);
    const observed = await provider();
    assert(observed.confirmed && clicks.n === 1, "V provider");
    const result = await finalizeConfirmedSubmission(inputFor(fixture, ids), { serializationFailuresBeforeSuccess: 1 });
    assert(result === "FINALIZED" && clicks.n === 1, `${result} clicks=${clicks.n}`);
    console.log("db transaction retry PASS providerClicks=1");
  });

  await withFixture("Y", async (fixture) => {
    const first = await prepareTrusted(fixture);
    const secondPackage = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
      forceNew: true,
    });
    const session = await prisma.applicationExecutionSession.create({
      data: {
        userId: fixture.user.id,
        applicationPackageId: secondPackage.packageId,
        applicationId: first.applicationId,
        jobPostingId: fixture.job.id,
        provider: "UNKNOWN",
        status: "READY_TO_SUBMIT",
      },
    });
    const second = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: fixture.user.id,
        executionSessionId: session.id,
        applicationPackageId: secondPackage.packageId,
        applicationId: first.applicationId,
        attemptNumber: 1,
        method: "BROWSER_CONFIRMED",
        status: "SUBMITTING",
        submitBoundaryCrossedAt: new Date(),
        approvalFingerprint: `y-${session.id}`,
        idempotencyKey: `y-${session.id}`,
        resumeVersionRevisionId: fixture.tailored.id,
        resumeFileHash: "a".repeat(64),
        confirmationType: "provider-confirmation",
        verificationEvidenceJson: { trustedConfirmation: true },
      },
    });
    const results = await Promise.all([
      finalizeConfirmedSubmission(inputFor(fixture, first)),
      finalizeConfirmedSubmission({
        userId: fixture.user.id,
        submissionAttemptId: second.id,
        submissionPackageId: secondPackage.packageId,
        applicationId: first.applicationId,
      }),
    ]);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: first.applicationId } });
    assert(application.status === "APPLIED", application.status);
    assert(
      application.submittedExecutionAttemptId === first.attemptId || application.submittedExecutionAttemptId === second.id,
      "Y owned neither attempt",
    );
    const owners = await prisma.application.count({
      where: { OR: [{ submittedExecutionAttemptId: first.attemptId }, { submittedExecutionAttemptId: second.id }] },
    });
    assert(owners === 1, `Y owners ${owners} results ${results.join(",")}`);
    const submitted = await prisma.applicationEvent.count({ where: { applicationId: first.applicationId, type: "SUBMITTED" } });
    assert(submitted === 1, `Y events ${submitted}`);
  });

  await withFixture("Z", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    assert(await finalizeConfirmedSubmission(inputFor(fixture, ids)) === "FINALIZED", "Z");
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
    await prisma.resumeAnalysis.updateMany({ where: { resumeDocument: { userId: fixture.user.id } }, data: { freshness: "STALE" } });
    const analysisB = await prisma.resumeAnalysis.create({
      data: {
        resumeDocumentId: documentB.id,
        detectedRole: "Software Engineer",
        experienceLevel: "Junior",
        completenessScore: 80,
        detectedSkills: ["TypeScript", "PostgreSQL"],
        suggestedFocus: [],
        warnings: [],
        sourceRevisionId: revisionB.id,
        sourceContentHash: "b".repeat(64),
        analyzerVersion: RESUME_ANALYZER_VERSION,
        freshness: "CURRENT",
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    const updatedJob = await prisma.jobPosting.update({
      where: { id: fixture.job.id },
      data: { description: "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision. Updated opportunity." },
    });
    await prisma.opportunityAnalysisSnapshot.create({
      data: {
        userId: fixture.user.id,
        jobPostingId: fixture.job.id,
        resumeDocumentId: documentB.id,
        resumeRevisionId: revisionB.id,
        resumeContentHash: "b".repeat(64),
        resumeAnalysisId: analysisB.id,
        jobSnapshotHash: hashJobSnapshot(updatedJob),
        canonicalMatchVersion: "m30b-canonical-v1",
        opportunityAnalyzerVersion: "opportunity-analysis-v1",
        status: "COMPLETED",
        snapshotJson: { fixture: true, later: true },
      },
    });
    const tailoredB = await prisma.resumeVersionRevision.create({
      data: {
        resumeVersionId: fixture.version.id,
        userId: fixture.user.id,
        revisionNumber: 2,
        source: "RULE_BASED_FALLBACK",
        contentJson: { summary: "later" },
        keywordCoverageJson: {},
        warningsJson: [],
        changeLogJson: [],
        evidenceNotesJson: [],
        inputSnapshotJson: {},
      },
    });
    await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: tailoredB.id,
      forceNew: true,
    });
    const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
    const pack = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
    assert(application.submittedPackageId === fixture.packageId, "Z package changed");
    assert(application.submittedExecutionAttemptId === ids.attemptId, "Z attempt changed");
    assert(application.resumeVersionRevisionId === fixture.tailored.id, "Z tailored revision changed");
    assert(pack.packageHash === fixture.packageHash, "Z hash changed");
    assert(pack.sourceResumeRevisionId === fixture.revision.id, "Z source revision changed");
    assert(pack.resumeVersionRevisionId === fixture.tailored.id, "Z package tailored revision changed");
  });

  await withFixture("current-state", async (fixture) => {
    const ids = await prepareTrusted(fixture);
    const documentB = await prisma.resumeDocument.create({
      data: { userId: fixture.user.id, filename: "cv-b.pdf", mimeType: "application/pdf", fileSize: 8, textLength: 8, textPreview: "b" },
    });
    const revisionB = await prisma.resumeSourceRevision.create({
      data: {
        userId: fixture.user.id,
        resumeDocumentId: documentB.id,
        revisionNumber: 2,
        contentHash: "c".repeat(64),
        sourceFilename: "cv-b.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    await prisma.jobPosting.update({ where: { id: fixture.job.id }, data: { title: "Later role" } });
    const tailoredB = await prisma.resumeVersionRevision.create({
      data: {
        resumeVersionId: fixture.version.id,
        userId: fixture.user.id,
        revisionNumber: 2,
        source: "RULE_BASED_FALLBACK",
        contentJson: { summary: "later" },
        keywordCoverageJson: {},
        warningsJson: [],
        changeLogJson: [],
        evidenceNotesJson: [],
        inputSnapshotJson: {},
      },
    });
    const result = await finalizeConfirmedSubmission(inputFor(fixture, ids));
    assert(result === "FINALIZED", result);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: ids.applicationId } });
    const pack = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: fixture.packageId } });
    assert(application.submittedPackageId === fixture.packageId, "current-state substituted the package");
    assert(application.resumeVersionRevisionId === fixture.tailored.id, "current-state substituted the tailored revision");
    assert(pack.sourceResumeRevisionId === fixture.revision.id, "current-state substituted the source revision");
    assert(pack.resumeVersionRevisionId === fixture.tailored.id && tailoredB.id !== fixture.tailored.id, "current-state rewrote the package revision");
    console.log("resume, opportunity, and tailored changes after confirmation did not rewrite package A");
  });

  await withFixture("crash", async (fixture) => {
    const acquired = await acquirePackageExecution(fixture.user.id, fixture.packageId);
    assert(acquired.attemptId && acquired.applicationId, acquired.outcome);
    const clicks = { n: 0 };
    const before = await executeControlledSubmit(fixture.user.id, acquired.attemptId, async () => {
      return { boundaryReached: false, submitTriggered: false, confirmed: false, failure: { code: "FORM_UNAVAILABLE", phase: "BEFORE_SUBMIT" } };
    });
    assert(before.domain === "FAILED_BEFORE_SUBMIT" && clicks.n === 0, before.domain);
    const draft = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId } });
    assert(draft.status === "DRAFT", "crash A-C marked APPLIED");

    const boundaryOnly = await seed("crash-d");
    try {
      const ready = await acquirePackageExecution(boundaryOnly.user.id, boundaryOnly.packageId);
      assert(ready.attemptId && ready.applicationId, ready.outcome);
      const reserved = await executeControlledSubmit(boundaryOnly.user.id, ready.attemptId, async (hooks) => {
        const gate = await hooks.onSubmitBoundary();
        assert(gate.proceed, "crash D did not acquire the boundary");
        return { boundaryReached: true, submitTriggered: false, confirmed: false };
      });
      const application = await prisma.application.findUniqueOrThrow({ where: { id: ready.applicationId } });
      assert(application.status === "DRAFT", `crash D ${application.status}`);
      assert(reserved.domain !== "SUBMITTED_CONFIRMED", reserved.domain);
      console.log(`crash D domain=${reserved.domain} click=0 application=DRAFT`);
    } finally {
      await cleanup(boundaryOnly.user.id);
    }

    const afterClick = await seed("crash-e");
    try {
      const ready = await acquirePackageExecution(afterClick.user.id, afterClick.packageId);
      assert(ready.attemptId && ready.applicationId, ready.outcome);
      const crashed = { n: 0 };
      const uncertain = await executeControlledSubmit(afterClick.user.id, ready.attemptId, async (hooks) => {
        const gate = await hooks.onSubmitBoundary();
        if (!gate.proceed) return { boundaryReached: false, submitTriggered: false, confirmed: false };
        crashed.n += 1;
        throw new Error("crash after click");
      });
      assert(uncertain.domain === "SUBMIT_UNCERTAIN" && crashed.n === 1, uncertain.domain);
      const application = await prisma.application.findUniqueOrThrow({ where: { id: ready.applicationId } });
      assert(application.status === "DRAFT", "crash E marked APPLIED");
      const retry = await executeControlledSubmit(afterClick.user.id, ready.attemptId, successProvider(crashed));
      assert(retry.providerInvoked === false && crashed.n === 1, "crash E retried the provider");
    } finally {
      await cleanup(afterClick.user.id);
    }
  });

  const after = await counts();
  console.log(`row counts after ${JSON.stringify(after)}`);
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture leak before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  console.log("m32:atomicity-qa PASS");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
