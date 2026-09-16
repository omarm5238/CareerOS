import { randomBytes } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import type { LinkedinPublishingAttemptStatus } from "@/generated/prisma/client";

import { toPrismaJson } from "../../lib/json-parsers";
import { LinkedinAccessError, assertOwnedPlan } from "../../lib/permissions";
import { snapshotCapabilities } from "../capabilities/resolve-capabilities";
import {
  currentCapabilities,
  getLinkedinConnectionRecord,
  markConnectionReauthRequired,
  readDecryptedAccessToken,
} from "../connection/lifecycle";
import { getLinkedinTokenState, isUsableLinkedinToken } from "../connection/token-state";
import { LinkedinIntegrationError, LINKEDIN_ERROR_MESSAGES, sanitizeProviderError } from "../errors";
import { classifyLinkedinProviderError } from "../provider/classify-provider-error";
import { getLinkedinApiClient } from "../provider";
import { LinkedinProviderRequestError } from "../provider/types";
import { buildLinkedinPublishText } from "./build-publish-text";
import { linkedinContentFingerprint } from "./content-fingerprint";
import type { LinkedinPublishReview } from "./publish-review-types";

const UNRESOLVED_STATUSES: LinkedinPublishingAttemptStatus[] = [
  "CREATED",
  "VALIDATING",
  "READY_TO_PUBLISH",
  "SUBMITTING",
  "VERIFYING",
  "UNCERTAIN",
];

const BLOCK_NEW_ATTEMPT: LinkedinPublishingAttemptStatus[] = [
  "READY_TO_PUBLISH",
  "SUBMITTING",
  "VERIFYING",
  "PUBLISHED",
  "UNCERTAIN",
];

export type { LinkedinPublishReview } from "./publish-review-types";

export type LinkedinPublishResult = {
  status: "PUBLISHED" | "FAILED" | "UNCERTAIN" | "IN_PROGRESS";
  attemptId: string;
  errorCode: string | null;
  message: string;
  externalLinkedInPostId: string | null;
  externalLinkedInUrl: string | null;
  revisionId: string;
};

export async function prepareLinkedinOfficialPublish(
  userId: string,
  planId: string,
  body: Record<string, unknown> = {},
): Promise<LinkedinPublishReview> {
  void body.revisionId;
  const plan = await assertOwnedPlan(userId, planId);
  const revision = plan.linkedinPostRevision;
  const post = plan.linkedinPost;
  const finalText = buildLinkedinPublishText(revision);
  const fingerprint = linkedinContentFingerprint({
    linkedinPostRevisionId: plan.linkedinPostRevisionId,
    finalText,
    format: post.format,
  });
  const connection = await getLinkedinConnectionRecord(userId);
  const capabilities = currentCapabilities(connection);
  const publishCapability = capabilities.PUBLISH_MEMBER_POST;
  const newer = Boolean(post.activeRevisionId && post.activeRevisionId !== plan.linkedinPostRevisionId);

  if (plan.status === "PUBLISHED") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_ALREADY_COMPLETED");
  }
  if (plan.status === "CANCELLED" || plan.status === "STALE") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_PLAN_STALE");
  }
  if (plan.status !== "READY" && plan.status !== "SCHEDULED") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_PLAN_STALE");
  }

  const blocking = await prisma.linkedinPublishingAttempt.findFirst({
    where: { linkedinPublishingPlanId: plan.id, status: { in: BLOCK_NEW_ATTEMPT } },
    orderBy: { createdAt: "desc" },
  });
  if (blocking) {
    if (blocking.status === "READY_TO_PUBLISH" && blocking.contentFingerprint === fingerprint) {
      return toReview(blocking, plan, revision.revisionNumber, finalText, fingerprint, connection, publishCapability, newer);
    }
    if (blocking.status === "PUBLISHED") throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_ALREADY_COMPLETED");
    if (blocking.status === "UNCERTAIN") throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_UNCERTAIN");
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_IN_PROGRESS");
  }

  const reusable = await prisma.linkedinPublishingAttempt.findFirst({
    where: {
      linkedinPublishingPlanId: plan.id,
      contentFingerprint: fingerprint,
      status: { in: ["CREATED", "VALIDATING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const attempt =
    reusable ??
    (await prisma.linkedinPublishingAttempt.create({
      data: {
        userId,
        linkedinConnectionId: connection?.id ?? null,
        linkedinPublishingPlanId: plan.id,
        linkedinPostId: post.id,
        linkedinPostRevisionId: plan.linkedinPostRevisionId,
        status: "CREATED",
        contentFingerprint: fingerprint,
        capabilitySnapshotJson: toPrismaJson(snapshotCapabilities(capabilities)),
      },
    }));

  const validated = await validateAttempt(userId, attempt.id, fingerprint);
  return toReview(
    validated,
    plan,
    revision.revisionNumber,
    finalText,
    fingerprint,
    connection,
    publishCapability,
    newer,
  );
}

async function validateAttempt(userId: string, attemptId: string, expectedFingerprint: string) {
  const attempt = await prisma.linkedinPublishingAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      linkedinPublishingPlan: { include: { linkedinPost: true, linkedinPostRevision: true } },
    },
  });
  if (!attempt) throw new LinkedinAccessError("NOT_FOUND", "Publishing attempt not found.");

  await prisma.linkedinPublishingAttempt.update({
    where: { id: attempt.id },
    data: { status: "VALIDATING" },
  });

  try {
    const plan = attempt.linkedinPublishingPlan;
    const connection = await getLinkedinConnectionRecord(userId);
    if (!connection || connection.status === "DISCONNECTED") {
      throw new LinkedinIntegrationError("LINKEDIN_NOT_CONNECTED");
    }
    const tokenState = getLinkedinTokenState(connection);
    if (tokenState === "EXPIRED") {
      await markConnectionReauthRequired(connection.id);
      throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });
    }
    if (!isUsableLinkedinToken(tokenState) || connection.status === "REAUTH_REQUIRED") {
      throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });
    }
    const capabilities = currentCapabilities(connection);
    if (capabilities.PUBLISH_MEMBER_POST.state === "AVAILABLE_NOT_GRANTED") {
      throw new LinkedinIntegrationError("LINKEDIN_SCOPE_MISSING", undefined, { capabilityRefreshRequired: true });
    }
    if (capabilities.PUBLISH_MEMBER_POST.state !== "AVAILABLE") {
      throw new LinkedinIntegrationError("LINKEDIN_CAPABILITY_RESTRICTED");
    }
    if (plan.linkedinPost.format !== "TEXT_POST" && plan.linkedinPost.format !== "STORY_POST" && plan.linkedinPost.format !== "OPINION" && plan.linkedinPost.format !== "LESSON_LEARNED" && plan.linkedinPost.format !== "CAREER_REFLECTION" && plan.linkedinPost.format !== "HOW_TO" && plan.linkedinPost.format !== "CHECKLIST" && plan.linkedinPost.format !== "QUESTION" && plan.linkedinPost.format !== "RESOURCE_SHARE" && plan.linkedinPost.format !== "TECHNICAL_BREAKDOWN" && plan.linkedinPost.format !== "PROJECT_SHOWCASE" && plan.linkedinPost.format !== "CASE_STUDY" && plan.linkedinPost.format !== "MILESTONE") {
      throw new LinkedinIntegrationError("LINKEDIN_CONTENT_UNSUPPORTED");
    }
    const finalText = buildLinkedinPublishText(plan.linkedinPostRevision);
    const fingerprint = linkedinContentFingerprint({
      linkedinPostRevisionId: plan.linkedinPostRevisionId,
      finalText,
      format: plan.linkedinPost.format,
    });
    if (fingerprint !== expectedFingerprint || fingerprint !== attempt.contentFingerprint) {
      throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_CONTENT_CHANGED");
    }

    return prisma.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "READY_TO_PUBLISH",
        validatedAt: new Date(),
        linkedinConnectionId: connection.id,
        capabilitySnapshotJson: toPrismaJson(snapshotCapabilities(capabilities)),
      },
    });
  } catch (error) {
    await prisma.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: error instanceof LinkedinIntegrationError ? error.code : "LINKEDIN_PUBLISH_FAILED",
      },
    });
    throw error;
  }
}

export async function executeLinkedinOfficialPublish(
  userId: string,
  planId: string,
  body: Record<string, unknown> = {},
): Promise<LinkedinPublishResult> {
  void body.revisionId;
  const plan = await assertOwnedPlan(userId, planId);
  if (plan.status === "PUBLISHED" || plan.linkedinPost.status === "PUBLISHED") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_ALREADY_COMPLETED");
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  const attempt = await prisma.linkedinPublishingAttempt.findFirst({
    where: attemptId
      ? { id: attemptId, userId, linkedinPublishingPlanId: plan.id }
      : { userId, linkedinPublishingPlanId: plan.id, status: "READY_TO_PUBLISH" },
    orderBy: { createdAt: "desc" },
    include: {
      linkedinPublishingPlan: { include: { linkedinPost: true, linkedinPostRevision: true } },
    },
  });
  if (!attempt) throw new LinkedinAccessError("NOT_FOUND", "Ready publishing attempt not found.");
  if (attempt.status === "PUBLISHED") throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_ALREADY_COMPLETED");
  if (attempt.status === "UNCERTAIN") throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_UNCERTAIN");
  if (attempt.status === "SUBMITTING" || attempt.status === "VERIFYING") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_IN_PROGRESS");
  }
  if (attempt.status !== "READY_TO_PUBLISH") {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_FAILED", "Publish is only allowed from a prepared review.");
  }

  const connection = await getLinkedinConnectionRecord(userId);
  if (!connection?.encryptedAccessToken) throw new LinkedinIntegrationError("LINKEDIN_NOT_CONNECTED");
  const tokenState = getLinkedinTokenState(connection);
  if (!isUsableLinkedinToken(tokenState)) {
    if (tokenState === "EXPIRED") await markConnectionReauthRequired(connection.id);
    throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });
  }
  const capabilities = currentCapabilities(connection);
  if (capabilities.PUBLISH_MEMBER_POST.state === "AVAILABLE_NOT_GRANTED") {
    throw new LinkedinIntegrationError("LINKEDIN_SCOPE_MISSING", undefined, { capabilityRefreshRequired: true });
  }
  if (capabilities.PUBLISH_MEMBER_POST.state !== "AVAILABLE") {
    throw new LinkedinIntegrationError("LINKEDIN_CAPABILITY_RESTRICTED");
  }

  const finalText = buildLinkedinPublishText(attempt.linkedinPublishingPlan.linkedinPostRevision);
  const fingerprint = linkedinContentFingerprint({
    linkedinPostRevisionId: attempt.linkedinPostRevisionId,
    finalText,
    format: attempt.linkedinPublishingPlan.linkedinPost.format,
  });
  if (fingerprint !== attempt.contentFingerprint) {
    await prisma.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", failedAt: new Date(), errorCode: "LINKEDIN_PUBLISH_CONTENT_CHANGED" },
    });
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_CONTENT_CHANGED");
  }

  const claimed = await prisma.linkedinPublishingAttempt.updateMany({
    where: { id: attempt.id, status: "READY_TO_PUBLISH" },
    data: {
      status: "SUBMITTING",
      submittedAt: new Date(),
      providerRequestId: `li-pub-${randomBytes(8).toString("hex")}`,
    },
  });
  if (claimed.count !== 1) {
    throw new LinkedinIntegrationError("LINKEDIN_PUBLISH_IN_PROGRESS");
  }

  const submitting = await prisma.linkedinPublishingAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  const accessToken = await readDecryptedAccessToken(connection);
  if (!accessToken) throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });

  try {
    const client = getLinkedinApiClient();
    const published = await client.publishPost(accessToken, {
      authorUrn: connection.providerSubject ?? "",
      text: finalText,
      format: attempt.linkedinPublishingPlan.linkedinPost.format,
      contentFingerprint: fingerprint,
      providerRequestId: submitting.providerRequestId ?? `li-pub-${attempt.id}`,
    });

    await prisma.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: { status: "VERIFYING" },
    });

    if (!published.externalPostId) {
      const uncertain = await markUncertain(attempt.id, "LINKEDIN_INVALID_RESPONSE", { missingId: true });
      return toPublishResult(uncertain, "UNCERTAIN");
    }

    const verifiedAt = new Date();
    const success = await prisma.$transaction(async (tx) => {
      const nextAttempt = await tx.linkedinPublishingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PUBLISHED",
          verifiedAt,
          externalLinkedInPostId: published.externalPostId,
          externalLinkedInUrl: published.externalUrl,
        },
      });
      await tx.linkedinPublishingPlan.update({
        where: { id: plan.id },
        data: {
          status: "PUBLISHED",
          publishMode: "LINKEDIN_OFFICIAL",
          publishingSource: "LINKEDIN_OFFICIAL",
          publishedAt: plan.publishedAt ?? verifiedAt,
        },
      });
      await tx.linkedinPost.update({
        where: { id: plan.linkedinPostId },
        data: {
          status: "PUBLISHED",
          publishingSource: "LINKEDIN_OFFICIAL",
          publishedAt: plan.linkedinPost.publishedAt ?? verifiedAt,
          externalLinkedInPostId: published.externalPostId,
          externalLinkedInUrl: published.externalUrl ?? plan.linkedinPost.externalLinkedInUrl,
        },
      });
      return nextAttempt;
    });

    const { tryRecordMeaningfulCareerActivity } = await import(
      "@/features/daily-roadmap/activity/record-activity"
    );
    await tryRecordMeaningfulCareerActivity({
      userId,
      activityType: "LINKEDIN_PUBLISHED",
      fingerprint: `LINKEDIN_PUBLISHED:${plan.linkedinPostId}:${plan.id}`,
      sourceEntityType: "LINKEDIN_PLAN",
      sourceEntityId: plan.id,
      occurredAt: verifiedAt,
    });

    return toPublishResult(success, "PUBLISHED");
  } catch (error) {
    if (error instanceof LinkedinProviderRequestError) {
      const classified = classifyLinkedinProviderError(error.provider);
      if (classified.reauthRequired) await markConnectionReauthRequired(connection.id);
      if (classified.capabilityRefreshRequired) {
        await prisma.linkedinConnection.update({
          where: { id: connection.id },
          data: { capabilitySnapshotJson: toPrismaJson(snapshotCapabilities(currentCapabilities(connection))) },
        });
      }
      if (classified.uncertain) {
        const uncertain = await markUncertain(attempt.id, classified.code, error.provider);
        return toPublishResult(uncertain, "UNCERTAIN");
      }
      const failed = await prisma.linkedinPublishingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: classified.code,
          providerErrorJson: toPrismaJson(sanitizeProviderError(error.provider) ?? {}),
        },
      });
      return toPublishResult(failed, "FAILED");
    }
    const uncertain = await markUncertain(attempt.id, "LINKEDIN_PUBLISH_UNCERTAIN", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return toPublishResult(uncertain, "UNCERTAIN");
  }
}

async function markUncertain(attemptId: string, errorCode: string, details: unknown) {
  return prisma.linkedinPublishingAttempt.update({
    where: { id: attemptId },
    data: {
      status: "UNCERTAIN",
      errorCode,
      providerErrorJson: toPrismaJson(sanitizeProviderError(details) ?? {}),
    },
  });
}

export async function getLinkedinPublishingAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.linkedinPublishingAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      linkedinPublishingPlan: { include: { linkedinPostRevision: true, linkedinPost: true } },
    },
  });
  if (!attempt) throw new LinkedinAccessError("NOT_FOUND", "Publishing attempt not found.");
  return toAttemptView(attempt);
}

export async function resolveLinkedinPublishingAttempt(
  userId: string,
  attemptId: string,
  body: Record<string, unknown>,
) {
  const attempt = await prisma.linkedinPublishingAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { linkedinPublishingPlan: { include: { linkedinPost: true, linkedinPostRevision: true } } },
  });
  if (!attempt) throw new LinkedinAccessError("NOT_FOUND", "Publishing attempt not found.");
  if (attempt.status !== "UNCERTAIN") {
    throw new LinkedinAccessError("CONFLICT", "Only an uncertain publish attempt can be reconciled.");
  }

  const action = body.action === "CONFIRM_PUBLISHED" || body.action === "CONFIRM_NOT_PUBLISHED" ? body.action : null;
  if (!action) throw new LinkedinAccessError("INVALID_INPUT", "Provide CONFIRM_PUBLISHED or CONFIRM_NOT_PUBLISHED.");

  const resolvedAt = new Date();
  if (action === "CONFIRM_NOT_PUBLISHED") {
    const updated = await prisma.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: { status: "CANCELLED", resolvedAt, errorCode: attempt.errorCode },
    });
    return toAttemptView(updated);
  }

  const publishedAt = attempt.linkedinPublishingPlan.publishedAt ?? resolvedAt;
  const updated = await prisma.$transaction(async (tx) => {
    const nextAttempt = await tx.linkedinPublishingAttempt.update({
      where: { id: attempt.id },
      data: { status: "PUBLISHED", resolvedAt, verifiedAt: resolvedAt },
    });
    await tx.linkedinPublishingPlan.update({
      where: { id: attempt.linkedinPublishingPlanId },
      data: {
        status: "PUBLISHED",
        publishMode: "MANUAL",
        publishingSource: "USER_CONFIRMED",
        publishedAt,
      },
    });
    await tx.linkedinPost.update({
      where: { id: attempt.linkedinPostId },
      data: {
        status: "PUBLISHED",
        publishingSource: "USER_CONFIRMED",
        publishedAt: attempt.linkedinPublishingPlan.linkedinPost.publishedAt ?? publishedAt,
      },
    });
    return nextAttempt;
  });
  return toAttemptView(updated);
}

export async function hasUnresolvedLinkedinPublishAttempt(planId: string) {
  return prisma.linkedinPublishingAttempt.findFirst({
    where: { linkedinPublishingPlanId: planId, status: { in: UNRESOLVED_STATUSES } },
  });
}

function toReview(
  attempt: { id: string; status: LinkedinPublishingAttemptStatus },
  plan: { id: string; linkedinPostId: string; linkedinPostRevisionId: string; status: string },
  revisionNumber: number,
  finalText: string,
  fingerprint: string,
  connection: { status: string; displayName: string | null; email: string | null } | null,
  publishCapability: { state: string; reason: string },
  newer: boolean,
): LinkedinPublishReview {
  return {
    attemptId: attempt.id,
    planId: plan.id,
    postId: plan.linkedinPostId,
    revisionId: plan.linkedinPostRevisionId,
    revisionNumber,
    finalText,
    contentFingerprint: fingerprint,
    connectionSummary: {
      status: connection?.status ?? "DISCONNECTED",
      displayName: connection?.displayName ?? null,
      email: connection?.email ?? null,
    },
    capabilitySummary: {
      capability: "PUBLISH_MEMBER_POST",
      state: publishCapability.state,
      reason: publishCapability.reason,
    },
    attemptStatus: attempt.status,
    newerRevisionExists: newer,
    newerRevisionWarning: newer
      ? `A newer revision exists. This publishing plan still uses Revision ${revisionNumber}.`
      : null,
    planStatus: plan.status,
    officialPublishAvailable: publishCapability.state === "AVAILABLE" && attempt.status === "READY_TO_PUBLISH",
  };
}

function toPublishResult(
  attempt: {
    id: string;
    status: LinkedinPublishingAttemptStatus;
    errorCode: string | null;
    externalLinkedInPostId: string | null;
    externalLinkedInUrl: string | null;
    linkedinPostRevisionId: string;
  },
  status: LinkedinPublishResult["status"],
): LinkedinPublishResult {
  const errorCode = attempt.errorCode;
  return {
    status,
    attemptId: attempt.id,
    errorCode,
    message:
      status === "PUBLISHED"
        ? "Published to LinkedIn."
        : errorCode && errorCode in LINKEDIN_ERROR_MESSAGES
          ? LINKEDIN_ERROR_MESSAGES[errorCode as keyof typeof LINKEDIN_ERROR_MESSAGES]
          : LINKEDIN_ERROR_MESSAGES.LINKEDIN_PUBLISH_FAILED,
    externalLinkedInPostId: attempt.externalLinkedInPostId,
    externalLinkedInUrl: attempt.externalLinkedInUrl,
    revisionId: attempt.linkedinPostRevisionId,
  };
}

export function toAttemptView(attempt: {
  id: string;
  status: LinkedinPublishingAttemptStatus;
  linkedinPublishingPlanId: string;
  linkedinPostId: string;
  linkedinPostRevisionId: string;
  contentFingerprint: string;
  externalLinkedInPostId: string | null;
  externalLinkedInUrl: string | null;
  errorCode: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  failedAt: Date | null;
  resolvedAt: Date | null;
  linkedinPublishingPlan?: { linkedinPostRevision?: { revisionNumber: number } };
}) {
  const errorCode = attempt.errorCode;
  const recoveryActions = recoveryForAttempt(attempt.status, errorCode);
  return {
    id: attempt.id,
    status: attempt.status,
    planId: attempt.linkedinPublishingPlanId,
    postId: attempt.linkedinPostId,
    revisionId: attempt.linkedinPostRevisionId,
    revisionNumber: attempt.linkedinPublishingPlan?.linkedinPostRevision?.revisionNumber ?? null,
    contentFingerprint: attempt.contentFingerprint,
    externalLinkedInPostId: attempt.externalLinkedInPostId,
    externalLinkedInUrl: attempt.externalLinkedInUrl,
    errorCode,
    message:
      errorCode && errorCode in LINKEDIN_ERROR_MESSAGES
        ? LINKEDIN_ERROR_MESSAGES[errorCode as keyof typeof LINKEDIN_ERROR_MESSAGES]
        : attempt.status === "PUBLISHED"
          ? "Published to LinkedIn."
          : null,
    createdAt: attempt.createdAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    verifiedAt: attempt.verifiedAt?.toISOString() ?? null,
    failedAt: attempt.failedAt?.toISOString() ?? null,
    resolvedAt: attempt.resolvedAt?.toISOString() ?? null,
    recoveryActions,
  };
}

function recoveryForAttempt(status: LinkedinPublishingAttemptStatus, errorCode: string | null): string[] {
  if (status === "UNCERTAIN") return ["CONFIRM_PUBLISHED", "CONFIRM_NOT_PUBLISHED"];
  if (status === "FAILED" && errorCode === "LINKEDIN_REAUTH_REQUIRED") return ["RECONNECT", "MANUAL_FALLBACK"];
  if (status === "FAILED" && errorCode === "LINKEDIN_SCOPE_MISSING") return ["GRANT_PERMISSION", "MANUAL_FALLBACK"];
  if (status === "FAILED") return ["RETRY", "MANUAL_FALLBACK"];
  if (status === "PUBLISHED") return [];
  return ["MANUAL_FALLBACK"];
}
