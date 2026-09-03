import { prisma } from "@/server/db/prisma";
import { createApplicationForJob } from "@/features/applications/lib/create-application-for-job";
import { derivePreparationState } from "./get-queue-for-user";

export async function startQueueApplication(
  userId: string,
  queueItemId: string,
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  const item = await prisma.applicationQueueItem.findFirst({
    where: { id: queueItemId, userId },
    select: {
      id: true,
      jobPostingId: true,
      resumeVersionId: true,
      applicationId: true,
      queueStatus: true,
      preparationError: true,
    },
  });

  if (!item) return { ok: false, error: "Queue item not found." };
  if (item.applicationId) return { ok: false, error: "Application already started." };
  if (!item.jobPostingId) return { ok: false, error: "Job not prepared yet." };

  // Re-derive state to check readiness
  let resumeStatus: string | null = null;
  if (item.resumeVersionId) {
    const rv = await prisma.resumeVersion.findUnique({
      where: { id: item.resumeVersionId },
      select: { status: true, activeRevisionId: true },
    });
    resumeStatus = rv?.status ?? null;
  }

  const state = derivePreparationState({
    ...item,
    resumeStatus,
  });

  if (state !== "READY_TO_APPLY") {
    return { ok: false, error: `Not ready. Current state: ${state}` };
  }

  // Get the exact active revision
  let revisionId: string | null = null;
  if (item.resumeVersionId) {
    const version = await prisma.resumeVersion.findUnique({
      where: { id: item.resumeVersionId },
      select: { activeRevisionId: true, status: true },
    });
    if (version?.status === "READY" && version.activeRevisionId) {
      revisionId = version.activeRevisionId;
    }
  }

  try {
    const result = await createApplicationForJob({
      userId,
      targetJobId: item.jobPostingId,
      resumeVersionId: item.resumeVersionId,
      resumeVersionRevisionId: revisionId,
      source: "DISCOVERY_QUEUE",
    });

    await prisma.applicationQueueItem.update({
      where: { id: item.id },
      data: {
        applicationId: result.applicationId,
        queueStatus: "HANDED_OFF",
        handedOffAt: new Date(),
      },
    });

    return { ok: true, applicationId: result.applicationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create application.";
    return { ok: false, error: message };
  }
}
