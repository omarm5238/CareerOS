import "dotenv/config";

import { readdirSync } from "node:fs";

import { Prisma } from "@/generated/prisma/client";
import { hashSubmissionPackage, submissionIdempotencyKey } from "@/features/application-packages/provenance/package-hash";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function counts() {
  const [application, timeline, packageCount, execution, resumeVersion, resumeVersionRevision, snapshot] = await Promise.all([
    prisma.application.count(),
    prisma.applicationEvent.count(),
    prisma.applicationPackage.count(),
    prisma.applicationSubmissionAttempt.count(),
    prisma.resumeVersion.count(),
    prisma.resumeVersionRevision.count(),
    prisma.opportunityAnalysisSnapshot.count(),
  ]);
  return { application, timeline, packageCount, execution, resumeVersion, resumeVersionRevision, snapshot };
}

async function rejected(run: () => Promise<unknown>, message: string) {
  try {
    await run();
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
    assert(code === "P2003" || code === "P2002", `${message} (${code || (error instanceof Error ? error.message : "unknown")})`);
    return;
  }
  throw new Error(message);
}

async function main() {
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(migrations.length === 23, `expected 23 migrations, found ${migrations.length}`);
  assert(migrations.some((entry) => entry.name.endsWith("_add_application_execution_integrity")), "M32 migration is missing");
  const before = await counts();
  const historical = await prisma.application.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, updatedAt: true, submittedPackageId: true, submittedExecutionAttemptId: true },
  });
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { name: "M32.1", email: `m32-1-${stamp}@careeros.local` },
  });

  try {
    const document = await prisma.resumeDocument.create({
      data: {
        userId: user.id,
        filename: "m32.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        textLength: 20,
        textPreview: "preview",
      },
    });
    const revision = await prisma.resumeSourceRevision.create({
      data: {
        userId: user.id,
        resumeDocumentId: document.id,
        revisionNumber: 1,
        contentHash: "a".repeat(64),
        sourceFilename: "m32.pdf",
        isActive: true,
      },
    });
    const analysis = await prisma.resumeAnalysis.create({
      data: {
        resumeDocumentId: document.id,
        detectedRole: "Engineer",
        experienceLevel: "Entry / Junior",
        completenessScore: 80,
        detectedSkills: [],
        suggestedFocus: [],
        warnings: [],
        sourceRevisionId: revision.id,
        sourceContentHash: revision.contentHash,
        freshness: "CURRENT",
      },
    });
    const job = await prisma.jobPosting.create({
      data: { userId: user.id, title: "Backend Engineer", company: "CareerOS QA", description: "TypeScript backend role with enough text." },
    });
    const snapshot = await prisma.opportunityAnalysisSnapshot.create({
      data: {
        userId: user.id,
        jobPostingId: job.id,
        resumeDocumentId: document.id,
        resumeRevisionId: revision.id,
        resumeContentHash: revision.contentHash,
        resumeAnalysisId: analysis.id,
        jobSnapshotHash: "b".repeat(64),
        canonicalMatchVersion: "m30b-canonical-v1",
        opportunityAnalyzerVersion: "opportunity-analysis-v1",
        status: "COMPLETED",
        snapshotJson: { fixture: true },
      },
    });
    const tailored = await prisma.resumeVersion.create({
      data: { userId: user.id, targetJobId: job.id, title: "Tailored", status: "READY" },
    });
    const tailoredRevision = await prisma.resumeVersionRevision.create({
      data: {
        resumeVersionId: tailored.id,
        userId: user.id,
        revisionNumber: 1,
        source: "RULE_BASED_FALLBACK",
        contentJson: { summary: "fixture" },
        keywordCoverageJson: {},
        warningsJson: [],
        changeLogJson: [],
        evidenceNotesJson: [],
        inputSnapshotJson: {},
      },
    });
    const draft = await prisma.communicationDraft.create({
      data: { userId: user.id, jobPostingId: job.id, type: "COVER_LETTER", status: "READY" },
    });
    const letter = await prisma.communicationDraftRevision.create({
      data: {
        communicationDraftId: draft.id,
        userId: user.id,
        revisionNumber: 1,
        source: "RULE_BASED_FALLBACK",
        content: "Cover letter fixture.",
        tone: "PROFESSIONAL",
        length: "STANDARD",
        language: "ENGLISH",
        contextSnapshotJson: {},
        contextFingerprint: "letter",
      },
    });
    const application = await prisma.application.create({
      data: { userId: user.id, jobPostingId: job.id, status: "DRAFT", contextSnapshotJson: {} },
    });

    const identity = {
      jobPostingId: job.id,
      jobSnapshotHash: snapshot.jobSnapshotHash,
      opportunityAnalysisSnapshotId: snapshot.id,
      sourceResumeRevisionId: revision.id,
      sourceResumeContentHash: revision.contentHash,
      resumeAnalysisId: analysis.id,
      tailoredResumeVersionId: tailored.id,
      tailoredResumeRevisionId: tailoredRevision.id,
      communicationDraftId: draft.id,
      communicationRevisionId: letter.id,
      provider: "GENERIC",
    };
    const packageHash = hashSubmissionPackage(identity);
    const again = hashSubmissionPackage(identity);
    assert(packageHash === again, "package hash is not stable");
    const changedTailored = hashSubmissionPackage({ ...identity, tailoredResumeRevisionId: "other-revision" });
    assert(changedTailored !== packageHash, "tailored revision did not change the package hash");
    const changedSource = hashSubmissionPackage({ ...identity, sourceResumeRevisionId: "other-source", sourceResumeContentHash: "c".repeat(64) });
    assert(changedSource !== packageHash, "source revision did not change the package hash");

    const row = await prisma.applicationPackage.create({
      data: {
        userId: user.id,
        jobPostingId: job.id,
        applicationId: application.id,
        version: 1,
        resumeVersionId: tailored.id,
        resumeVersionRevisionId: tailoredRevision.id,
        coverLetterDraftId: draft.id,
        coverLetterRevisionId: letter.id,
        contextFingerprint: "legacy-fingerprint",
        opportunityAnalysisSnapshotId: snapshot.id,
        sourceResumeRevisionId: revision.id,
        sourceResumeContentHash: revision.contentHash,
        resumeAnalysisId: analysis.id,
        packageHash,
        packageJson: identity,
        lockedAt: new Date(),
        status: "APPROVED",
      },
    });
    const loaded = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: row.id } });
    assert(loaded.jobPostingId === job.id, "job FK did not persist");
    assert(loaded.opportunityAnalysisSnapshotId === snapshot.id, "opportunity snapshot FK did not persist");
    assert(loaded.sourceResumeRevisionId === revision.id, "source revision did not persist");
    assert(loaded.sourceResumeContentHash === revision.contentHash, "source hash did not persist");
    assert(loaded.resumeAnalysisId === analysis.id, "resume analysis did not persist");
    assert(loaded.resumeVersionId === tailored.id && loaded.resumeVersionRevisionId === tailoredRevision.id, "tailored revision did not persist");
    assert(loaded.coverLetterRevisionId === letter.id, "communication revision did not persist");
    assert(loaded.packageHash === packageHash, "persisted package hash mismatch");

    await rejected(
      () => prisma.applicationPackage.create({
        data: {
          userId: user.id,
          jobPostingId: job.id,
          version: 2,
          contextFingerprint: "bad-snapshot",
          opportunityAnalysisSnapshotId: "missing-snapshot",
        },
      }),
      "invalid opportunity snapshot FK was accepted",
    );
    await rejected(
      () => prisma.applicationPackage.create({
        data: {
          userId: user.id,
          jobPostingId: job.id,
          version: 3,
          contextFingerprint: "bad-revision",
          sourceResumeRevisionId: "missing-revision",
        },
      }),
      "invalid source revision FK was accepted",
    );
    await rejected(
      () => prisma.applicationPackage.create({
        data: {
          userId: user.id,
          jobPostingId: job.id,
          version: 4,
          contextFingerprint: "bad-analysis",
          resumeAnalysisId: "missing-analysis",
        },
      }),
      "invalid resume analysis FK was accepted",
    );
    await rejected(
      () => prisma.applicationPackage.create({
        data: {
          userId: user.id,
          jobPostingId: "missing-job",
          version: 1,
          contextFingerprint: "bad-job",
        },
      }),
      "invalid job FK was accepted",
    );

    const session = await prisma.applicationExecutionSession.create({
      data: {
        userId: user.id,
        applicationPackageId: row.id,
        applicationId: application.id,
        jobPostingId: job.id,
        provider: "GENERIC",
        status: "READY_TO_SUBMIT",
      },
    });
    const key = submissionIdempotencyKey({ userId: user.id, submissionPackageId: row.id, provider: "GENERIC" });
    const attempt = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: user.id,
        executionSessionId: session.id,
        applicationPackageId: row.id,
        applicationId: application.id,
        attemptNumber: 1,
        method: "BROWSER_CONFIRMED",
        status: "COMPLETED",
        approvalFingerprint: "review",
        resumeVersionRevisionId: tailoredRevision.id,
        resumeFileHash: "resume-hash",
        coverLetterRevisionId: letter.id,
        idempotencyKey: key,
        destinationUrl: "http://127.0.0.1/fixture",
        submitBoundaryCrossedAt: new Date(),
        confirmationType: "provider_success",
      },
    });
    const linked = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert(linked.applicationPackageId === row.id, "execution attempt does not reference the package");
    assert(linked.idempotencyKey === key, "idempotency key did not persist");

    const sessionB = await prisma.applicationExecutionSession.create({
      data: {
        userId: user.id,
        applicationPackageId: row.id,
        applicationId: application.id,
        jobPostingId: job.id,
        provider: "GENERIC",
      },
    });
    await rejected(
      () => prisma.applicationSubmissionAttempt.create({
        data: {
          userId: user.id,
          executionSessionId: sessionB.id,
          applicationPackageId: row.id,
          applicationId: application.id,
          attemptNumber: 1,
          method: "BROWSER_CONFIRMED",
          approvalFingerprint: "duplicate",
          resumeVersionRevisionId: tailoredRevision.id,
          resumeFileHash: "resume-hash",
          idempotencyKey: key,
          status: "FAILED",
        },
      }),
      "duplicate idempotency key was accepted",
    );

    const legacy = await prisma.application.create({
      data: { userId: user.id, status: "DRAFT", contextSnapshotJson: { legacy: true } },
    });
    const legacyLoaded = await prisma.application.findUniqueOrThrow({ where: { id: legacy.id } });
    assert(legacyLoaded.submittedPackageId === null && legacyLoaded.submittedExecutionAttemptId === null, "legacy application invented provenance");

    if (historical) {
      const afterHistorical = await prisma.application.findUniqueOrThrow({
        where: { id: historical.id },
        select: { status: true, updatedAt: true, submittedPackageId: true, submittedExecutionAttemptId: true },
      });
      assert(afterHistorical.status === historical.status, "historical application status changed");
      assert(afterHistorical.updatedAt.getTime() === historical.updatedAt.getTime(), "historical application was rewritten");
      assert(afterHistorical.submittedPackageId === historical.submittedPackageId, "historical package link changed");
      assert(afterHistorical.submittedExecutionAttemptId === historical.submittedExecutionAttemptId, "historical execution link changed");
    }
  } finally {
    await prisma.application.updateMany({
      where: { userId: user.id },
      data: { submittedPackageId: null, submittedExecutionAttemptId: null },
    });
    await prisma.applicationSubmissionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.applicationExecutionEvent.deleteMany({ where: { userId: user.id } });
    await prisma.applicationExecutionSession.deleteMany({ where: { userId: user.id } });
    await prisma.applicationPackage.deleteMany({ where: { userId: user.id } });
    await prisma.applicationEvent.deleteMany({ where: { userId: user.id } });
    await prisma.application.deleteMany({ where: { userId: user.id } });
    await prisma.communicationDraftRevision.deleteMany({ where: { userId: user.id } });
    await prisma.communicationDraft.deleteMany({ where: { userId: user.id } });
    await prisma.resumeVersion.updateMany({ where: { userId: user.id }, data: { activeRevisionId: null } });
    await prisma.resumeVersionRevision.deleteMany({ where: { userId: user.id } });
    await prisma.resumeVersion.deleteMany({ where: { userId: user.id } });
    await prisma.opportunityAnalysisSnapshot.deleteMany({ where: { userId: user.id } });
    await prisma.resumeAnalysis.deleteMany({ where: { resumeDocument: { userId: user.id } } });
    await prisma.resumeSourceRevision.deleteMany({ where: { userId: user.id } });
    await prisma.resumeDocument.deleteMany({ where: { userId: user.id } });
    await prisma.jobPosting.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `row counts changed ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.log("m32-1:qa PASS");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
