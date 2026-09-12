import { prisma } from "@/server/db/prisma";

import { getActiveGrowthProfile, LinkedinAccessError } from "../lib/permissions";
import { toPrismaJson } from "../lib/json-parsers";
import { toInsightView } from "../lib/views";
import { findLinkedinVisibilityGaps } from "../recommendations/find-linkedin-visibility-gaps";
import { calculateLinkedinContentPatterns } from "./calculate-linkedin-content-patterns";

export async function generateLinkedinGrowthInsights(userId: string) {
  const profile = await getActiveGrowthProfile(userId);
  if (!profile) throw new LinkedinAccessError("NOT_FOUND", "Activate a strategy before generating insights.");

  const patterns = await calculateLinkedinContentPatterns(userId);
  const gaps = await findLinkedinVisibilityGaps(userId);
  const insights = [];

  if (patterns.publishedCount <= 1) {
    insights.push({
      type: "POSTING_FREQUENCY" as const,
      title: "Early activity",
      summary:
        patterns.publishedCount === 0
          ? "No published posts are recorded yet. Insights stay descriptive until CareerOS has manual performance snapshots."
          : "One published post is recorded. This is descriptive only and does not show what your audience prefers.",
      confidence: "descriptive",
      evidenceJson: { publishedCount: patterns.publishedCount, postIds: [] },
    });
  } else if (patterns.confidence === "weak") {
    insights.push({
      type: "FORMAT_PERFORMANCE" as const,
      title: "Weak early signal",
      summary: `You have ${patterns.publishedCount} published posts. Any comparison is a weak signal, not a lasting preference.`,
      confidence: "weak",
      evidenceJson: { publishedCount: patterns.publishedCount, pillars: patterns.pillars },
    });
  } else if (patterns.pillars.length >= 2) {
    const [top, second] = patterns.pillars;
    insights.push({
      type: "PILLAR_PERFORMANCE" as const,
      title: "Pillar pattern",
      summary: `Your last ${patterns.publishedCount} published posts include ${top.count} ${top.name} posts${
        top.profileViews && second
          ? `, which recorded more recorded profile views than ${second.name}`
          : ""
      }. This is a ${patterns.confidence} pattern, not a causal rule.`,
      confidence: patterns.confidence,
      evidenceJson: { pillars: patterns.pillars, publishedCount: patterns.publishedCount },
    });
  }

  const overused = patterns.pillars.find((item) => item.count >= 3);
  if (overused) {
    insights.push({
      type: "CONTENT_GAP" as const,
      title: "Repeated pillar",
      summary: `${overused.name} has appeared ${overused.count} times in recent published posts. Consider balancing unless that repetition is deliberate.`,
      confidence: patterns.confidence,
      evidenceJson: { pillar: overused },
    });
  }

  for (const gap of gaps.filter((item) => item.recommendation === "POST").slice(0, 3)) {
    insights.push({
      type: "CONTENT_GAP" as const,
      title: `Visibility gap: ${gap.topic}`,
      summary: gap.reason,
      confidence: "moderate",
      evidenceJson: { gap },
    });
  }

  await prisma.linkedinGrowthInsight.updateMany({
    where: { userId, linkedinGrowthProfileId: profile.id, status: "ACTIVE" },
    data: { status: "DISMISSED", dismissedAt: new Date() },
  });

  if (insights.length > 0) {
    await prisma.linkedinGrowthInsight.createMany({
      data: insights.map((insight) => ({
        userId,
        linkedinGrowthProfileId: profile.id,
        type: insight.type,
        title: insight.title,
        summary: insight.summary,
        evidenceJson: toPrismaJson(insight.evidenceJson),
        confidence: insight.confidence,
        status: "ACTIVE",
      })),
    });
  }

  const rows = await prisma.linkedinGrowthInsight.findMany({
    where: { userId, linkedinGrowthProfileId: profile.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toInsightView);
}

export async function listLinkedinInsights(userId: string) {
  const rows = await prisma.linkedinGrowthInsight.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map(toInsightView);
}
