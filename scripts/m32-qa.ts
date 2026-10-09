import "dotenv/config";
import { execSync } from "node:child_process";

import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import { evaluateApplicationReadiness } from "@/features/application-packages/readiness/evaluate-application-readiness";
import type { ProviderExecutionResult } from "@/features/application-execution/integrity/execution-domain";
import { acquirePackageExecution, confirmTrackedSubmission, executeControlledSubmit } from "@/features/application-execution/integrity/run-package-execution";
import { isGlobalConfirmedSubmitEnabled, isProviderSubmitSwitchEnabled } from "@/features/application-execution/lib/env-flags";
import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runStage(script: string) {
  execSync(`npx tsx ${script}`, { stdio: "inherit", cwd: process.cwd() });
}

async function seed(label: string, title: string, description: string, level: string, skills: string[]) {
  const user = await prisma.user.create({ data: { name: label, email: `m32-master-${label}-${Date.now()}@careeros.local` } });
  const document = await prisma.resumeDocument.create({
    data: { userId: user.id, filename: "cv.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 20, textPreview: "preview" },
  });
  const hash = "c".repeat(64);
  const revision = await prisma.resumeSourceRevision.create({
    data: { userId: user.id, resumeDocumentId: document.id, revisionNumber: 1, contentHash: hash, sourceFilename: "cv.pdf", isActive: true },
  });
  const analysis = await prisma.resumeAnalysis.create({
    data: {
      resumeDocumentId: document.id,
      detectedRole: "Software Engineer",
      experienceLevel: level,
      completenessScore: 80,
      detectedSkills: skills,
      suggestedFocus: [],
      warnings: [],
      sourceRevisionId: revision.id,
      sourceContentHash: hash,
      analyzerVersion: RESUME_ANALYZER_VERSION,
      freshness: "CURRENT",
    },
  });
  const job = await prisma.jobPosting.create({
    data: { userId: user.id, title, company: "CareerOS QA", location: "Istanbul", description },
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
  return { user, document, revision, job, version, tailored };
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

async function main() {
  runStage("scripts/m32-1-qa.ts");
  runStage("scripts/m32-2-qa.ts");
  runStage("scripts/m32-3-qa.ts");
  runStage("scripts/m32-atomicity-qa.ts");

  const description = "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision.";
  const fixture = await seed("eligible", "Backend Engineer", description, "Junior", ["TypeScript", "PostgreSQL"]);
  try {
    const built = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
    });
    assert(built.readiness.status === "READY", built.readiness.blockers.join(","));
    const before = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: built.packageId } });

    await prisma.jobPosting.update({
      where: { id: fixture.job.id },
      data: { description: `${description} Required: Kubernetes.` },
    });
    const staleJob = await evaluateApplicationReadiness(fixture.user.id, built.packageId);
    assert(staleJob.status === "BLOCKED", "changed job snapshot stayed executable");
    const blocked = await acquirePackageExecution(fixture.user.id, built.packageId);
    assert(blocked.outcome === "BLOCKED" && blocked.attemptId === null, "stale package started execution");
    await prisma.jobPosting.update({ where: { id: fixture.job.id }, data: { description } });

    const documentB = await prisma.resumeDocument.create({
      data: { userId: fixture.user.id, filename: "cv-b.pdf", mimeType: "application/pdf", fileSize: 8, textLength: 8, textPreview: "b" },
    });
    const revisionB = await prisma.resumeSourceRevision.create({
      data: {
        userId: fixture.user.id,
        resumeDocumentId: documentB.id,
        revisionNumber: 2,
        contentHash: "9".repeat(64),
        sourceFilename: "cv-b.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    const staleResume = await acquirePackageExecution(fixture.user.id, built.packageId);
    assert(staleResume.outcome === "BLOCKED", "stale resume started execution");
    const unchanged = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: built.packageId } });
    assert(unchanged.packageHash === before.packageHash, "package hash changed after a later resume");
    assert(unchanged.sourceResumeRevisionId === before.sourceResumeRevisionId, "package source revision was rewritten");

    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: true } });
    const acquired = await acquirePackageExecution(fixture.user.id, built.packageId);
    assert(acquired.outcome === "ACQUIRED" && acquired.attemptId, acquired.outcome);
    const clicks = { n: 0 };
    const confirmed = await executeControlledSubmit(fixture.user.id, acquired.attemptId, async (hooks) => {
      const gate = await hooks.onSubmitBoundary();
      if (!gate.proceed) return { boundaryReached: false, submitTriggered: false, confirmed: false } satisfies ProviderExecutionResult;
      clicks.n += 1;
      return { boundaryReached: true, submitTriggered: true, confirmed: true, confirmationEvidence: "master-confirmation", providerReference: "qa-local" };
    });
    assert(confirmed.domain === "SUBMITTED_CONFIRMED" && clicks.n === 1, confirmed.domain);
    await confirmTrackedSubmission(fixture.user.id, acquired.attemptId, "qa-local", "master-confirmation");
    const applied = await prisma.application.findUniqueOrThrow({ where: { id: acquired.applicationId! } });
    assert(applied.status === "APPLIED", applied.status);
    await confirmTrackedSubmission(fixture.user.id, acquired.attemptId, "qa-local", "master-confirmation");
    const events = await prisma.applicationEvent.count({ where: { applicationId: applied.id, type: "SUBMITTED" } });
    assert(events === 1, `confirmed replay created ${events} submission events`);
    const attempts = await prisma.applicationSubmissionAttempt.count({
      where: { applicationPackageId: built.packageId, status: "COMPLETED", verificationStatus: "VERIFIED" },
    });
    assert(attempts === 1, `confirmed replay created ${attempts} confirmations`);
  } finally {
    await cleanup(fixture.user.id);
  }

  const dotnet = await seed(
    "dotnet",
    "Senior .NET Full-stack Developer",
    "Required: C#, .NET, and 8+ years of commercial experience. Senior full-stack role.",
    "Entry / Junior",
    ["TypeScript", "JavaScript", "Go", "React", "Next.js", "PostgreSQL"],
  );
  try {
    const built = await buildSubmissionPackage(dotnet.user.id, dotnet.job.id, {
      tailoredResumeVersionId: dotnet.version.id,
      tailoredResumeRevisionId: dotnet.tailored.id,
    });
    assert(built.readiness.status === "BLOCKED" && built.readiness.blockers.includes("JOB_INELIGIBLE"), built.readiness.blockers.join(","));
    const acquired = await acquirePackageExecution(dotnet.user.id, built.packageId);
    assert(acquired.outcome === "BLOCKED" && acquired.attemptId === null, "ineligible package was executable");
  } finally {
    await cleanup(dotnet.user.id);
  }

  const liveEnabled = isGlobalConfirmedSubmitEnabled() || (["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE", "SMARTRECRUITERS"] as const).some((provider) => isProviderSubmitSwitchEnabled(provider));
  console.log(liveEnabled
    ? "LIVE PROVIDER SWITCHES ARE SET — no approved safe employer target is configured, so live submit was not run"
    : "LIVE SUBMIT VALIDATION BLOCKED — NO APPROVED TEST TARGET");
  console.log("m32:qa PASS");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
