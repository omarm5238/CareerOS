import { prisma } from "@/server/db/prisma";

import { toIdeaView } from "../lib/views";
import type { LinkedinIdeaView } from "../types";
import { findLinkedinVisibilityGaps } from "./find-linkedin-visibility-gaps";

export async function recommendNextLinkedinIdeas(userId: string): Promise<LinkedinIdeaView[]> {
  const now = new Date();
  const ideas = await prisma.linkedinContentIdea.findMany({
    where: {
      userId,
      status: { in: ["NEW", "SHORTLISTED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      timeliness: { not: "EXPIRED" },
    },
    include: { pillar: true },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  const recentPosts = await prisma.linkedinPost.findMany({
    where: { userId, createdAt: { gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) } },
    select: { pillarId: true },
  });
  const pillarUse = new Map<string, number>();
  for (const post of recentPosts) {
    if (!post.pillarId) continue;
    pillarUse.set(post.pillarId, (pillarUse.get(post.pillarId) ?? 0) + 1);
  }
  const gaps = await findLinkedinVisibilityGaps(userId);
  const gapTopics = new Set(gaps.filter((gap) => gap.recommendation === "POST").map((gap) => gap.topic.toLowerCase()));

  return ideas
    .map((idea) => {
      let score = idea.priorityScore;
      const used = idea.pillarId ? pillarUse.get(idea.pillarId) ?? 0 : 0;
      if (used >= 2) score -= 12;
      if ([...gapTopics].some((topic) => `${idea.title} ${idea.angle}`.toLowerCase().includes(topic))) {
        score += 10;
      }
      const why = `${idea.summary} Content Priority ${idea.priorityScore}/100${used >= 2 ? "; this pillar was used recently." : ""}.`;
      return { idea, score, view: toIdeaView(idea, why) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.view);
}
