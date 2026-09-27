import "dotenv/config";

import {
  beginDelete,
  confirmDelete,
  deleteFailed,
  deleteSucceeded,
  idleDeleteUi,
  selectJob,
} from "@/features/jobs/lib/job-delete-ui-state";
import { deleteJobPostingForUser } from "@/features/jobs/lib/delete-job-posting-for-user";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testStateMachine() {
  const jobA = "job-a";
  const jobB = "job-b";
  const jobC = "job-c";

  let state = confirmDelete(idleDeleteUi(), jobA);
  const deletingA = beginDelete(state, jobA);
  assert(deletingA?.deletingJobId === jobA, "A. delete enters DELETING(jobId)");
  state = deleteSucceeded(deletingA, jobA);
  assert(state.deletingJobId === null, "A. success clears pending");
  assert(state.removedJobId === jobA, "A. success marks the deleted job removed");
  assert(state.error === null, "A. success has no error");

  state = selectJob(state, jobB);
  assert(state.deletingJobId === null, "B. switching jobs does not keep Deleting");
  assert(state.removedJobId === null, "B. removed flag does not stick to the next job");
  const deletingB = beginDelete(confirmDelete(state, jobB), jobB);
  assert(deletingB?.deletingJobId === jobB, "B. second delete can start without refresh");
  state = selectJob(deleteSucceeded(deletingB, jobB), jobC);
  const deletingC = beginDelete(confirmDelete(state, jobC), jobC);
  assert(deletingC?.deletingJobId === jobC, "C. third sequential delete can start");
  state = deleteSucceeded(deletingC, jobC);
  assert(state.deletingJobId === null && state.removedJobId === jobC, "C. third delete returns to idle-removed");

  const failed = deleteFailed(beginDelete(confirmDelete(idleDeleteUi(), jobA), jobA)!, jobA, "Could not delete this job.");
  assert(failed.deletingJobId === null, "D. failure clears pending");
  assert(failed.removedJobId === null, "D. failure keeps the job");
  assert(failed.confirmingJobId === jobA, "D. confirmation stays open for retry");
  assert(failed.error === "Could not delete this job.", "D. error is visible");
  const retry = beginDelete(failed, jobA);
  assert(retry?.deletingJobId === jobA, "D. user can retry");

  const inFlight = beginDelete(confirmDelete(idleDeleteUi(), jobA), jobA)!;
  assert(beginDelete(inFlight, jobA) === null, "E. repeated click does not start a second deletion");

  const afterA = deleteSucceeded(inFlight, jobA);
  const onB = selectJob(afterA, jobB);
  assert(onB.removedJobId !== jobB && onB.deletingJobId !== jobB, "G. deleting A does not mark B");
}

async function testPersistence() {
  const email = "m30a-qa@careeros.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: { email, name: "M30A QA", emailVerified: false },
  });

  try {
    const resume = await prisma.resumeDocument.create({
      data: {
        userId: user.id,
        filename: "m30a-resume.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
        textLength: 20,
        textPreview: "M30A resume",
      },
    });

    const jobA = await prisma.jobPosting.create({
      data: {
        userId: user.id,
        title: "M30A Job A",
        company: "M30A Labs",
        description: "Disposable M30A job A used only to verify deletion integrity.",
      },
    });
    const jobB = await prisma.jobPosting.create({
      data: {
        userId: user.id,
        title: "M30A Job B",
        company: "M30A Labs",
        description: "Disposable M30A job B that must survive deletion of job A.",
      },
    });

    const version = await prisma.resumeVersion.create({
      data: {
        userId: user.id,
        title: "M30A tailored",
        sourceResumeDocumentId: resume.id,
        targetJobId: jobA.id,
      },
    });

    const unrelatedApplication = await prisma.application.create({
      data: {
        userId: user.id,
        jobPostingId: jobB.id,
        contextSnapshotJson: { source: "m30a" },
      },
    });

    const insight = await prisma.skillsInsight.create({
      data: { userId: user.id, jobCount: 2 },
    });

    const deleted = await deleteJobPostingForUser(user.id, jobA.id);
    assert(deleted, "F. canonical delete reports success");

    const gone = await prisma.jobPosting.findUnique({ where: { id: jobA.id } });
    const kept = await prisma.jobPosting.findUnique({ where: { id: jobB.id } });
    assert(!gone, "F. deleted job stays deleted");
    assert(kept?.title === "M30A Job B", "G. other job remains intact");

    const resumeAfter = await prisma.resumeDocument.findUnique({ where: { id: resume.id } });
    const versionAfter = await prisma.resumeVersion.findUnique({ where: { id: version.id } });
    const applicationAfter = await prisma.application.findUnique({
      where: { id: unrelatedApplication.id },
    });
    const insightAfter = await prisma.skillsInsight.findUnique({ where: { id: insight.id } });

    assert(resumeAfter?.id === resume.id, "resume source remains");
    assert(versionAfter?.id === version.id, "unrelated resume version remains");
    assert(versionAfter?.targetJobId === null, "deleted job link on the version is cleared by existing schema");
    assert(applicationAfter?.jobPostingId === jobB.id, "application for the other job stays linked");
    assert(insightAfter?.id === insight.id, "skills remain while another saved job exists");

    const second = await deleteJobPostingForUser(user.id, jobA.id);
    assert(second === false, "deleting an already removed job does not report success");
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

async function run() {
  testStateMachine();
  await testPersistence();
  console.log(JSON.stringify({ ok: true, state: "PASS", persistence: "PASS" }));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
