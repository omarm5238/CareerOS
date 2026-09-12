import { prisma } from "@/server/db/prisma";

import { buildLinkedinCareerContext } from "../context/build-linkedin-career-context";
import { hasEvidenceForTopic } from "../lib/claim-safety";
import type { LinkedinVisibilityGap } from "../types";

export async function findLinkedinVisibilityGaps(userId: string): Promise<LinkedinVisibilityGap[]> {
  const context = await buildLinkedinCareerContext(userId);
  const recentPosts = await prisma.linkedinPost.findMany({
    where: { userId, status: { in: ["DRAFT", "READY", "PUBLISHED"] } },
    include: { activeRevision: true, contentIdea: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const corpus = recentPosts
    .map((post) => `${post.contentIdea?.title ?? ""} ${post.activeRevision?.body ?? ""}`.toLowerCase())
    .join(" ");

  const topics = context.jobRequirementPatterns.map((item) => item.name);

  const gaps: LinkedinVisibilityGap[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const evidence = hasEvidenceForTopic(context, topic);
    const recentCoverage = (corpus.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    if (evidence && recentCoverage === 0) {
      gaps.push({
        topic,
        hasEvidence: true,
        evidenceLabel: evidence.label,
        recentCoverage,
        recommendation: "POST",
        reason: `Target roles repeatedly value ${topic}, you have evidence for it, and recent LinkedIn drafts do not cover it.`,
      });
    } else if (!evidence) {
      gaps.push({
        topic,
        hasEvidence: false,
        evidenceLabel: null,
        recentCoverage,
        recommendation: "BUILD_EVIDENCE",
        reason: `Build evidence first for ${topic}. CareerOS will not recommend an expertise post without verified support.`,
      });
    }
  }

  return gaps.slice(0, 8);
}
