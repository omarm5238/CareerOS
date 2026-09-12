import { prisma } from "@/server/db/prisma";

export function insightConfidence(publishedCount: number): "descriptive" | "weak" | "moderate" | "stronger" {
  if (publishedCount <= 1) return "descriptive";
  if (publishedCount <= 3) return "weak";
  if (publishedCount <= 7) return "moderate";
  return "stronger";
}

export async function calculateLinkedinContentPatterns(userId: string) {
  const posts = await prisma.linkedinPost.findMany({
    where: { userId, status: "PUBLISHED" },
    include: {
      pillar: true,
      performances: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });

  const pillarCounts = new Map<string, { name: string; count: number; profileViews: number }>();
  for (const post of posts) {
    const name = post.pillar?.name ?? "Unassigned";
    const current = pillarCounts.get(name) ?? { name, count: 0, profileViews: 0 };
    current.count += 1;
    current.profileViews += post.performances[0]?.profileViews ?? 0;
    pillarCounts.set(name, current);
  }

  return {
    publishedCount: posts.length,
    confidence: insightConfidence(posts.length),
    pillars: [...pillarCounts.values()].sort((a, b) => b.count - a.count),
  };
}
