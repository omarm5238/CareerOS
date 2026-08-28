import { prisma } from "@/server/db/prisma";

import {
  ApplicationAccessError,
  assertJobOwnedByUser,
  assertResumeLinkOwnedByUser,
} from "./application-permissions";
import { buildApplicationSnapshot } from "./build-application-snapshot";
import { recordApplicationEvent } from "./create-application-event";
import { toPrismaJson } from "./json-parsers";

export type CreateApplicationForJobInput = {
  userId: string;
  targetJobId: string;
  resumeVersionId?: string | null;
  resumeVersionRevisionId?: string | null;
};

export type CreateApplicationForJobResult = {
  applicationId: string;
  status: "DRAFT";
  resumeLinked: boolean;
  resumeWarning: string | null;
  /** True when an in-progress draft already existed and was returned instead. */
  reusedExisting: boolean;
};

type ResumeSelection = {
  resumeVersionId: string;
  resumeVersionRevisionId: string;
  warning: string | null;
};

/**
 * Picks the resume to attach when the caller did not choose one:
 * a READY version for this job first, otherwise the newest non-archived draft
 * with an explicit warning. Never creates a tailored resume.
 */
async function selectBestResumeForJob(
  userId: string,
  jobPostingId: string,
): Promise<ResumeSelection | null> {
  const candidates = await prisma.resumeVersion.findMany({
    where: {
      userId,
      targetJobId: jobPostingId,
      status: { in: ["READY", "USED", "DRAFT"] },
      archivedAt: null,
      activeRevisionId: { not: null },
    },
    select: { id: true, status: true, activeRevisionId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  if (candidates.length === 0) return null;

  const ready = candidates.find((item) => item.status === "READY");
  const used = candidates.find((item) => item.status === "USED");
  const chosen = ready ?? used ?? candidates[0];

  if (!chosen?.activeRevisionId) return null;

  return {
    resumeVersionId: chosen.id,
    resumeVersionRevisionId: chosen.activeRevisionId,
    warning:
      chosen.status === "DRAFT"
        ? "Linked resume version is still a draft. Review it and mark it Ready before you submit."
        : null,
  };
}

export async function createApplicationForJob(
  input: CreateApplicationForJobInput,
): Promise<CreateApplicationForJobResult> {
  await assertJobOwnedByUser(input.userId, input.targetJobId);

  // Duplicate protection: an unfinished draft for the same job is reopened
  // rather than duplicated when the button is double-clicked.
  const existingDraft = await prisma.application.findFirst({
    where: { userId: input.userId, jobPostingId: input.targetJobId, status: "DRAFT" },
    select: { id: true, resumeVersionId: true },
    orderBy: { createdAt: "desc" },
  });

  if (existingDraft) {
    return {
      applicationId: existingDraft.id,
      status: "DRAFT",
      resumeLinked: existingDraft.resumeVersionId !== null,
      resumeWarning: null,
      reusedExisting: true,
    };
  }

  const activeAttempt = await prisma.application.findFirst({
    where: {
      userId: input.userId,
      jobPostingId: input.targetJobId,
      status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"] },
    },
    select: { id: true },
  });

  if (activeAttempt) {
    throw new ApplicationAccessError(
      "CONFLICT",
      "An active application already exists for this job. Open it from the tracker.",
    );
  }

  let selection: ResumeSelection | null = null;

  if (input.resumeVersionId) {
    const { version, revision } = await assertResumeLinkOwnedByUser(
      input.userId,
      input.resumeVersionId,
      input.resumeVersionRevisionId,
    );
    selection = {
      resumeVersionId: version.id,
      resumeVersionRevisionId: revision.id,
      warning: null,
    };
  } else {
    selection = await selectBestResumeForJob(input.userId, input.targetJobId);
  }

  const snapshot = await buildApplicationSnapshot({
    userId: input.userId,
    jobPostingId: input.targetJobId,
    resumeVersionId: selection?.resumeVersionId ?? null,
    resumeVersionRevisionId: selection?.resumeVersionRevisionId ?? null,
  });

  const applicationId = await prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        userId: input.userId,
        jobPostingId: input.targetJobId,
        status: "DRAFT",
        source: "JOBS_MODULE",
        resumeVersionId: selection?.resumeVersionId ?? null,
        resumeVersionRevisionId: selection?.resumeVersionRevisionId ?? null,
        contextSnapshotJson: toPrismaJson(snapshot),
        lastActivityAt: new Date(),
        nextActionType: "SUBMIT_APPLICATION",
        nextActionTitle: "Submit this application",
        nextActionReason:
          "The application is prepared but not submitted yet. Mark it applied once you send it.",
        nextActionSource: "RULE_BASED",
      },
      select: { id: true },
    });

    await recordApplicationEvent(tx, {
      applicationId: application.id,
      userId: input.userId,
      type: "CREATED",
      source: "SYSTEM",
      title: "Application created",
      description: snapshot.job.title
        ? `Started tracking ${snapshot.job.title}${
            snapshot.job.company ? ` at ${snapshot.job.company}` : ""
          }.`
        : null,
    });

    if (selection) {
      await recordApplicationEvent(tx, {
        applicationId: application.id,
        userId: input.userId,
        type: "RESUME_LINKED",
        source: "SYSTEM",
        title: "Resume linked",
        description: snapshot.resume.resumeVersionTitle
          ? `${snapshot.resume.resumeVersionTitle} · Revision ${
              snapshot.resume.revisionNumber ?? "?"
            }`
          : null,
      });
    }

    return application.id;
  });

  return {
    applicationId,
    status: "DRAFT",
    resumeLinked: selection !== null,
    resumeWarning: selection?.warning ?? null,
    reusedExisting: false,
  };
}
