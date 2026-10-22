import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import { acquirePackageExecution } from "@/features/application-execution/integrity/run-package-execution";
import type { StructuredSubmitEvidence } from "@/features/application-execution/integrity/external-submission-contract";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { prisma } from "@/server/db/prisma";

const DESCRIPTION =
  "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision.";

export type ReadyFixture = {
  userId: string;
  documentId: string;
  revisionId: string;
  analysisId: string;
  hash: string;
};

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function counts() {
  const [applications, packages, attempts, sessions, applicationEvents, executionEvents, authorizations] = await Promise.all([
    prisma.application.count(),
    prisma.applicationPackage.count(),
    prisma.applicationSubmissionAttempt.count(),
    prisma.applicationExecutionSession.count(),
    prisma.applicationEvent.count(),
    prisma.applicationExecutionEvent.count(),
    prisma.applicationSubmitAuthorization.count(),
  ]);
  return { applications, packages, attempts, sessions, applicationEvents, executionEvents, authorizations };
}

export async function attachFixture(userId: string): Promise<ReadyFixture> {
  const document = await prisma.resumeDocument.create({
    data: { userId, filename: "cv.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 40, textPreview: "preview" },
  });
  const hash = "b".repeat(64);
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
  return { userId, documentId: document.id, revisionId: revision.id, analysisId: analysis.id, hash };
}

export async function createFixture(label: string): Promise<ReadyFixture> {
  const user = await prisma.user.create({ data: { name: label, email: `${label}-${Date.now()}@careeros.local` } });
  return attachFixture(user.id);
}

export async function createReadyAttempt(fixture: ReadyFixture) {
  const job = await prisma.jobPosting.create({
    data: { userId: fixture.userId, title: `Backend Engineer ${Date.now()}`, company: "CareerOS QA", location: "Istanbul", description: DESCRIPTION },
  });
  await prisma.opportunityAnalysisSnapshot.create({
    data: {
      userId: fixture.userId,
      jobPostingId: job.id,
      resumeDocumentId: fixture.documentId,
      resumeRevisionId: fixture.revisionId,
      resumeContentHash: fixture.hash,
      resumeAnalysisId: fixture.analysisId,
      jobSnapshotHash: hashJobSnapshot(job),
      canonicalMatchVersion: "m30b-canonical-v1",
      opportunityAnalyzerVersion: "opportunity-analysis-v1",
      status: "COMPLETED",
      snapshotJson: { fixture: true },
    },
  });
  const version = await prisma.resumeVersion.create({
    data: { userId: fixture.userId, targetJobId: job.id, title: "Tailored", status: "READY" },
  });
  const tailored = await prisma.resumeVersionRevision.create({
    data: {
      resumeVersionId: version.id,
      userId: fixture.userId,
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
  const built = await buildSubmissionPackage(fixture.userId, job.id, {
    tailoredResumeVersionId: version.id,
    tailoredResumeRevisionId: tailored.id,
  });
  assert(built.readiness.status === "READY", built.readiness.blockers.join(","));
  const acquired = await acquirePackageExecution(fixture.userId, built.packageId);
  assert(acquired.outcome === "ACQUIRED" && acquired.attemptId && acquired.applicationId, acquired.outcome);
  return {
    packageId: built.packageId,
    packageHash: built.packageHash,
    applicationId: acquired.applicationId,
    attemptId: acquired.attemptId,
    sessionId: acquired.sessionId,
    jobId: job.id,
    tailoredRevisionId: tailored.id,
    sourceRevisionId: fixture.revisionId,
  };
}

export async function cleanupFixture(userId: string) {
  await prisma.application.updateMany({ where: { userId }, data: { submittedPackageId: null, submittedExecutionAttemptId: null, resumeVersionRevisionId: null } });
  await prisma.applicationSubmitAuthorization.deleteMany({ where: { userId } });
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

export function evidence(partial: Partial<StructuredSubmitEvidence>): StructuredSubmitEvidence {
  return {
    clickAttempted: true,
    clickDispatched: false,
    navigationObserved: false,
    networkActivityObserved: false,
    domTransitionObserved: false,
    confirmationObserved: false,
    confirmationType: null,
    confirmationStrength: "NONE",
    providerReference: null,
    providerRejected: false,
    failureClassification: null,
    ...partial,
  };
}
