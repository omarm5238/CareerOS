import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { analyzeJobPostingForUser } from "@/features/jobs/lib/analyze-job-posting-for-user";
import { createResumeVersionForJob } from "@/features/resume/versions/lib/create-resume-version-for-job";
import type { QueuePreparationSnapshot } from "../../discovery/types";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function prepareQueueItem(
  userId: string,
  queueItemId: string,
): Promise<{ ok: true; snapshot: QueuePreparationSnapshot } | { ok: false; error: string }> {
  const item = await prisma.applicationQueueItem.findFirst({
    where: { id: queueItemId, userId },
    include: {
      discoveredJob: {
        select: {
          id: true, title: true, company: true, location: true,
          description: true, jobPostingId: true,
          sources: { select: { sourceUrl: true, applyUrl: true }, take: 1 },
        },
      },
    },
  });

  if (!item) return { ok: false, error: "Queue item not found." };
  if (item.queueStatus === "HANDED_OFF") return { ok: false, error: "Already handed off." };

  // Mark preparing
  await prisma.applicationQueueItem.update({
    where: { id: item.id },
    data: { queueStatus: "PREPARING", preparationError: null },
  });

  const snapshot: QueuePreparationSnapshot = { warnings: [] };
  const dj = item.discoveredJob;

  try {
    // Step 1: Promote to jobPosting
    let jobPostingId = item.jobPostingId ?? dj.jobPostingId;

    if (!jobPostingId) {
      // Check for existing job with same URL
      const sourceUrl = dj.sources[0]?.sourceUrl ?? null;
      if (sourceUrl) {
        const existing = await prisma.jobPosting.findFirst({
          where: { userId, jobUrl: sourceUrl },
          select: { id: true },
        });
        if (existing) jobPostingId = existing.id;
      }
    }

    if (!jobPostingId) {
      const newJob = await prisma.jobPosting.create({
        data: {
          userId,
          title: dj.title,
          company: dj.company,
          location: dj.location,
          description: dj.description.slice(0, 10000),
          source: dj.sources[0]?.sourceUrl ? `Discovery` : "Discovery",
          jobUrl: dj.sources[0]?.sourceUrl ?? null,
        },
      });
      jobPostingId = newJob.id;
      snapshot.jobPostingCreated = true;
    } else {
      snapshot.jobPostingCreated = false;
    }

    // Link job posting back to discovered job
    await prisma.discoveredJob.update({
      where: { id: dj.id },
      data: { jobPostingId },
    });

    await prisma.applicationQueueItem.update({
      where: { id: item.id },
      data: { jobPostingId },
    });

    snapshot.lastStep = "job_promoted";

    // Step 2: Run job analysis
    try {
      const analysisResult = await analyzeJobPostingForUser(userId, jobPostingId);
      if (analysisResult) {
        const ja = await prisma.jobAnalysis.findUnique({
          where: { jobPostingId },
          select: { id: true },
        });
        snapshot.jobAnalysisId = ja?.id ?? null;
      }
      snapshot.lastStep = "job_analyzed";
    } catch {
      snapshot.warnings?.push("Job analysis failed, continuing.");
    }

    // Step 3: Resolve/create resume
    let resumeVersionId = item.resumeVersionId;

    if (!resumeVersionId) {
      // Look for existing suitable resume version for this job
      const existingVersion = await prisma.resumeVersion.findFirst({
        where: {
          userId,
          targetJobId: jobPostingId,
          status: { in: ["READY", "DRAFT"] },
          archivedAt: null,
        },
        select: { id: true, status: true },
        orderBy: { updatedAt: "desc" },
      });

      if (existingVersion) {
        resumeVersionId = existingVersion.id;
        snapshot.resumeStatus = existingVersion.status;
      } else {
        // Create new tailored resume
        const tailorResult = await createResumeVersionForJob({
          userId,
          targetJobId: jobPostingId,
        });

        if (tailorResult.ok) {
          resumeVersionId = tailorResult.versionId;
          snapshot.resumeStatus = "DRAFT";
        } else {
          snapshot.warnings?.push(`Resume creation: ${tailorResult.message}`);
        }
      }
    }

    if (resumeVersionId) {
      await prisma.applicationQueueItem.update({
        where: { id: item.id },
        data: { resumeVersionId },
      });
      snapshot.resumeVersionId = resumeVersionId;
    }

    snapshot.lastStep = "resume_resolved";

    // Mark prepared
    await prisma.applicationQueueItem.update({
      where: { id: item.id },
      data: {
        queueStatus: "QUEUED",
        preparedAt: new Date(),
        preparationSnapshotJson: toJson(snapshot),
        preparationError: null,
      },
    });

    return { ok: true, snapshot };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preparation failed";
    await prisma.applicationQueueItem.update({
      where: { id: item.id },
      data: {
        queueStatus: "FAILED",
        preparationError: message.slice(0, 500),
        preparationSnapshotJson: toJson(snapshot),
      },
    });
    return { ok: false, error: message };
  }
}
