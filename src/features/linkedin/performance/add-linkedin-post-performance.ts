import { prisma } from "@/server/db/prisma";

import { assertOwnedPost, LinkedinAccessError } from "../lib/permissions";
import { toPerformanceView } from "../lib/views";
import { calculateLinkedinPerformanceMetrics } from "./calculate-linkedin-performance-metrics";

function readMetric(name: string, value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new LinkedinAccessError("INVALID_INPUT", `${name} must be a non-negative integer or omitted.`);
  }
  return value;
}

export async function addLinkedinPostPerformance(userId: string, postId: string, body: Record<string, unknown>) {
  const post = await assertOwnedPost(userId, postId);
  if (post.status !== "PUBLISHED") {
    throw new LinkedinAccessError("CONFLICT", "Performance snapshots can only be added to published posts.");
  }

  const metrics = {
    impressions: readMetric("impressions", body.impressions),
    views: readMetric("views", body.views),
    likes: readMetric("likes", body.likes),
    comments: readMetric("comments", body.comments),
    reposts: readMetric("reposts", body.reposts),
    saves: readMetric("saves", body.saves),
    profileViews: readMetric("profileViews", body.profileViews),
    newFollowers: readMetric("newFollowers", body.newFollowers),
    connectionRequests: readMetric("connectionRequests", body.connectionRequests),
    recruiterMessages: readMetric("recruiterMessages", body.recruiterMessages),
  };

  const capturedAt = typeof body.capturedAt === "string" ? new Date(body.capturedAt) : new Date();
  const row = await prisma.linkedinPostPerformance.create({
    data: {
      userId,
      linkedinPostId: post.id,
      capturedAt,
      ...metrics,
      source: "USER_ENTERED",
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });
  return toPerformanceView(row);
}

export async function getLinkedinPostPerformanceHistory(userId: string, postId: string) {
  await assertOwnedPost(userId, postId);
  const rows = await prisma.linkedinPostPerformance.findMany({
    where: { userId, linkedinPostId: postId },
    orderBy: { capturedAt: "desc" },
  });
  return rows.map(toPerformanceView);
}

export { calculateLinkedinPerformanceMetrics };
