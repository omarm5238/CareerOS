import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { toPrismaJson } from "@/features/application-execution/lib/json-parsers";
import { startFixtureServer, FIXTURE_ORIGIN } from "@/features/application-execution/fixtures/server";
import {
  cancelExecutionSession,
  closeAllBrowserRuntimes,
  createExecutionSession,
  fillSafeFields,
  generateFieldAnswer,
  getExecutionSession,
  grantSubmissionApproval,
  patchFieldAnswer,
  startExecutionSession,
} from "@/features/application-execution/server";
import { sessionJson } from "@/features/application-execution/sessions/load-owned-session";
import { reviewExecutionSession } from "@/features/application-execution/submission/review-execution-session";
import { buildFinalSubmissionSnapshot, submissionFingerprint } from "@/features/application-execution/submission/build-final-submission-snapshot";
import { loadOwnedSession } from "@/features/application-execution/sessions/load-owned-session";
import { resolveCoverLetterArtifact } from "@/features/application-execution/documents/resolve-cover-letter-artifact";
import { approveApplicationPackage } from "@/features/application-packages/lib/approve-application-package";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function getTestUser() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  return user;
}

async function createCover(userId: string, content: string, fingerprint: string) {
  const cover = await prisma.communicationDraft.create({
    data: {
      userId,
      type: "COVER_LETTER",
      status: "READY",
      revisions: {
        create: {
          userId,
          revisionNumber: 1,
          source: "USER_EDITED",
          content,
          tone: "PROFESSIONAL",
          length: "STANDARD",
          language: "ENGLISH",
          contextSnapshotJson: toPrismaJson({}),
          contextFingerprint: fingerprint,
        },
      },
    },
    include: { revisions: true },
  });
  await prisma.communicationDraft.update({
    where: { id: cover.id },
    data: { activeRevisionId: cover.revisions[0]!.id },
  });
  return cover;
}

async function createReadyPackage(userId: string, jobUrl: string, title: string, coverId: string, coverRevisionId: string, resumeRevisionId: string, resumeVersionId: string) {
  const job = await prisma.jobPosting.create({
    data: {
      userId,
      title,
      company: "Fixture Corp",
      description: "Backend Software Engineer role for CareerOS cover letter freeze QA.",
      jobUrl,
      source: "m245b-cover-freeze",
    },
  });
  const application = await prisma.application.create({
    data: {
      userId,
      jobPostingId: job.id,
      status: "DRAFT",
      source: "JOBS_MODULE",
      resumeVersionId,
      resumeVersionRevisionId: resumeRevisionId,
      contextSnapshotJson: toPrismaJson({ title: job.title }),
    },
  });
  const pkg = await prisma.applicationPackage.create({
    data: {
      userId,
      jobPostingId: job.id,
      applicationId: application.id,
      version: 1,
      resumeVersionId,
      resumeVersionRevisionId: resumeRevisionId,
      coverLetterDraftId: coverId,
      coverLetterRevisionId: coverRevisionId,
      status: "READY_FOR_REVIEW",
      readinessStatus: "READY",
      qaStatus: "PASS",
      qaSnapshotJson: toPrismaJson({ status: "PASS", checks: [], repairAttempted: 0 }),
      contextFingerprint: `m245b-cover-${job.id}`,
    },
  });
  return { job, application, pkg };
}

async function confirmRequired(userId: string, sessionId: string) {
  const view = await getExecutionSession(userId, sessionId);
  for (const field of view.fields) {
    if (field.classification === "LEGAL") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "yes", confirmed: true });
    } else if (field.classification === "CONSENT") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "true", confirmed: true });
    } else if (field.classification === "FREE_TEXT") {
      await generateFieldAnswer(userId, sessionId, field.id);
      const after = await getExecutionSession(userId, sessionId);
      const current = after.fields.find((item) => item.id === field.id);
      await patchFieldAnswer(userId, sessionId, field.id, {
        value: current?.proposedValue || "I am interested based on the provided resume facts.",
        confirmed: true,
        reviewed: true,
      });
    } else if (field.classification === "SENSITIVE") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "decline", confirmed: true });
    } else if (field.required && field.status === "NEEDS_INPUT") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "search", confirmed: true });
    } else if (field.classification === "CONTACT" && /phone/i.test(field.label)) {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "+49111111111", confirmed: true });
    }
  }
}

async function run() {
  const evidence: Record<string, unknown> = {};
  const fixtures = await startFixtureServer();
  const user = await getTestUser();
  await prisma.applicationExecutionSession.updateMany({
    where: { userId: user.id, status: { notIn: ["SUBMITTED", "CANCELLED", "FAILED", "BLOCKED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  const resume = await prisma.resumeVersion.findFirst({
    where: { userId: user.id, status: { in: ["READY", "USED", "DRAFT"] } },
    include: { revisions: { orderBy: { revisionNumber: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  if (!resume?.revisions[0]) throw new Error("Test resume is missing.");
  const resumeRevisionId = resume.revisions[0].id;

  try {
    const cover = await createCover(user.id, "Cover letter revision A — freeze this.", `cover-a-${Date.now()}`);
    const revisionA = cover.revisions[0]!;
    await prisma.resumeVersion.update({
      where: { id: resume.id },
      data: { status: "READY" },
    });
    const hashA = (await resolveCoverLetterArtifact({ userId: user.id, coverLetterDraftId: cover.id, lockedRevisionId: revisionA.id })).fileHash;

    const ready = await createReadyPackage(
      user.id,
      `${FIXTURE_ORIGIN}/greenhouse`,
      "M245B cover freeze approve-then-B",
      cover.id,
      revisionA.id,
      resumeRevisionId,
      resume.id,
    );
    const approved = await approveApplicationPackage(user.id, ready.pkg.id);
    const pkgAfterApprove = await prisma.applicationPackage.findUnique({ where: { id: ready.pkg.id } });
    evidence.approveStatus = approved.status;
    evidence.packageRevisionAfterApprove = pkgAfterApprove?.coverLetterRevisionId;
    assert(pkgAfterApprove?.status === "APPROVED", "Package must be APPROVED");
    assert(pkgAfterApprove?.coverLetterRevisionId === revisionA.id, "Approve must freeze cover letter revision A");

    const revisionB = await prisma.communicationDraftRevision.create({
      data: {
        userId: user.id,
        communicationDraftId: cover.id,
        revisionNumber: 2,
        source: "USER_EDITED",
        content: "Cover letter revision B — must not upload.",
        tone: "PROFESSIONAL",
        length: "STANDARD",
        language: "ENGLISH",
        contextSnapshotJson: toPrismaJson({}),
        contextFingerprint: `cover-b-${Date.now()}`,
      },
    });
    await prisma.communicationDraft.update({
      where: { id: cover.id },
      data: { activeRevisionId: revisionB.id },
    });
    const hashB = (await resolveCoverLetterArtifact({ userId: user.id, coverLetterDraftId: cover.id, lockedRevisionId: revisionB.id })).fileHash;
    const activeAfter = await prisma.communicationDraft.findUnique({ where: { id: cover.id } });
    evidence.activeAfterApprove = activeAfter?.activeRevisionId;
    evidence.hashB = hashB;
    assert(hashA !== hashB, "Revision A and B artifacts must hash differently");
    assert(activeAfter?.activeRevisionId === revisionB.id, "Active revision should now be B");
    const pkgStill = await prisma.applicationPackage.findUnique({ where: { id: ready.pkg.id } });
    assert(pkgStill?.coverLetterRevisionId === revisionA.id, "Package freeze must ignore later active B");

    const session = await createExecutionSession(user.id, ready.pkg.id);
    const createdRow = await loadOwnedSession(user.id, session.sessionId);
    evidence.sessionLockedRevision = sessionJson(createdRow).plan.lockedCoverLetterRevisionId;
    assert(sessionJson(createdRow).plan.lockedCoverLetterRevisionId === revisionA.id, "Session must inherit package-frozen A");

    await startExecutionSession(user.id, session.sessionId);
    await confirmRequired(user.id, session.sessionId);
    await fillSafeFields(user.id, session.sessionId);
    const afterFill = await loadOwnedSession(user.id, session.sessionId);
    const uploaded = sessionJson(afterFill).plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
    evidence.uploadedRevision = uploaded?.revisionId;
    evidence.uploadedHash = uploaded?.fileHash;
    evidence.hashA = hashA;
    assert(uploaded?.revisionId === revisionA.id, "Upload must use revision A");
    assert(uploaded?.revisionId !== revisionB.id, "Upload must not use revision B");
    assert(uploaded?.fileHash === hashA, "Upload hash must match revision A");

    await reviewExecutionSession(user.id, session.sessionId);
    const { snapshot, plan } = sessionJson(await loadOwnedSession(user.id, session.sessionId));
    assert(snapshot, "Form snapshot required");
    const finalSnapshot = buildFinalSubmissionSnapshot(afterFill, snapshot!, plan);
    evidence.finalSnapshotRevision = finalSnapshot.coverLetterRevisionId;
    evidence.finalFingerprint = submissionFingerprint(finalSnapshot);
    assert(finalSnapshot.coverLetterRevisionId === revisionA.id, "FinalSubmissionSnapshot must use A");

    try {
      const approval = await grantSubmissionApproval(user.id, session.sessionId);
      const attempt = await prisma.applicationSubmissionAttempt.findUnique({ where: { id: approval.attemptId } });
      evidence.attemptRevision = attempt?.coverLetterRevisionId;
      evidence.attemptPath = "grantSubmissionApproval";
      assert(attempt?.coverLetterRevisionId === revisionA.id, "SubmissionAttempt must record A");
    } catch (error) {
      evidence.attemptRevision = finalSnapshot.coverLetterRevisionId;
      evidence.attemptPath = "snapshot-mapping-confirmed-submit-disabled";
      evidence.attemptGrantError = error instanceof Error ? error.message : String(error);
      assert(finalSnapshot.coverLetterRevisionId === revisionA.id, "Attempt mapping must still use A when confirmed submit is disabled");
    }
    await cancelExecutionSession(user.id, session.sessionId);

    const cover2 = await createCover(user.id, "Session-lock cover A.", `cover2-a-${Date.now()}`);
    const a2 = cover2.revisions[0]!;
    const ready2 = await createReadyPackage(
      user.id,
      `${FIXTURE_ORIGIN}/greenhouse`,
      "M245B cover freeze session-then-B",
      cover2.id,
      a2.id,
      resumeRevisionId,
      resume.id,
    );
    await approveApplicationPackage(user.id, ready2.pkg.id);
    const session2 = await createExecutionSession(user.id, ready2.pkg.id);
    const b2 = await prisma.communicationDraftRevision.create({
      data: {
        userId: user.id,
        communicationDraftId: cover2.id,
        revisionNumber: 2,
        source: "USER_EDITED",
        content: "Session-lock cover B.",
        tone: "PROFESSIONAL",
        length: "STANDARD",
        language: "ENGLISH",
        contextSnapshotJson: toPrismaJson({}),
        contextFingerprint: `cover2-b-${Date.now()}`,
      },
    });
    await prisma.communicationDraft.update({ where: { id: cover2.id }, data: { activeRevisionId: b2.id } });
    await startExecutionSession(user.id, session2.sessionId);
    const afterSessionLock = await loadOwnedSession(user.id, session2.sessionId);
    const uploaded2 = sessionJson(afterSessionLock).plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
    evidence.sessionLockUploadedRevision = uploaded2?.revisionId;
    evidence.sessionLockActiveB = b2.id;
    assert(uploaded2?.revisionId === a2.id, "Existing session lock must keep A after later B");
    await cancelExecutionSession(user.id, session2.sessionId);

    evidence.ok = true;
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await closeAllBrowserRuntimes();
    await fixtures.close();
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
