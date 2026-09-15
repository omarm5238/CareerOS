import { prisma } from "@/server/db/prisma";

import { assertOwnedPost, LinkedinAccessError } from "../../lib/permissions";
import { toPerformanceView } from "../../lib/views";
import { currentCapabilities, getLinkedinConnectionRecord, readDecryptedAccessToken } from "../connection/lifecycle";
import { getLinkedinTokenState, isUsableLinkedinToken } from "../connection/token-state";
import { LinkedinIntegrationError } from "../errors";
import { getLinkedinApiClient } from "../provider";

export async function syncOfficialLinkedinPostAnalytics(userId: string, postId: string) {
  const post = await assertOwnedPost(userId, postId);
  if (post.status !== "PUBLISHED") {
    throw new LinkedinAccessError("CONFLICT", "Official analytics can only sync for a published post.");
  }
  const connection = await getLinkedinConnectionRecord(userId);
  const capabilities = currentCapabilities(connection);
  if (capabilities.POST_ANALYTICS.state === "APPROVAL_REQUIRED") {
    throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_NOT_APPROVED");
  }
  if (capabilities.POST_ANALYTICS.state === "AVAILABLE_NOT_GRANTED") {
    throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_NOT_GRANTED");
  }
  if (capabilities.POST_ANALYTICS.state !== "AVAILABLE") {
    throw new LinkedinIntegrationError("LINKEDIN_CAPABILITY_RESTRICTED");
  }
  if (!connection || !isUsableLinkedinToken(getLinkedinTokenState(connection))) {
    throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });
  }
  if (!post.externalLinkedInPostId) {
    throw new LinkedinAccessError("CONFLICT", "This post does not have a verified LinkedIn post id yet.");
  }

  const token = await readDecryptedAccessToken(connection);
  if (!token) throw new LinkedinIntegrationError("LINKEDIN_REAUTH_REQUIRED", undefined, { reauthRequired: true });

  try {
    const analytics = await getLinkedinApiClient().getPostAnalytics?.(token, post.externalLinkedInPostId);
    if (!analytics) throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_NOT_APPROVED");
    const row = await prisma.linkedinPostPerformance.create({
      data: {
        userId,
        linkedinPostId: post.id,
        capturedAt: new Date(),
        impressions: analytics.impressions,
        views: analytics.views,
        likes: analytics.likes,
        comments: analytics.comments,
        reposts: analytics.reposts,
        saves: analytics.saves,
        source: "LINKEDIN_OFFICIAL",
      },
    });
    return toPerformanceView(row);
  } catch (error) {
    if (error instanceof LinkedinIntegrationError) throw error;
    throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_SYNC_FAILED");
  }
}

export async function syncOfficialLinkedinProfileAnalytics(userId: string) {
  const connection = await getLinkedinConnectionRecord(userId);
  const capabilities = currentCapabilities(connection);
  if (capabilities.PROFILE_ANALYTICS.state === "APPROVAL_REQUIRED") {
    throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_NOT_APPROVED");
  }
  if (capabilities.PROFILE_ANALYTICS.state === "AVAILABLE_NOT_GRANTED") {
    throw new LinkedinIntegrationError("LINKEDIN_ANALYTICS_NOT_GRANTED");
  }
  if (capabilities.PROFILE_ANALYTICS.state !== "AVAILABLE") {
    throw new LinkedinIntegrationError("LINKEDIN_CAPABILITY_RESTRICTED");
  }
  return {
    stored: false,
    message: "Official profile analytics are recognized but CareerOS does not persist a separate profile analytics model yet.",
    capability: capabilities.PROFILE_ANALYTICS,
  };
}
