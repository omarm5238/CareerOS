import { prisma } from "@/server/db/prisma";

import { generateLinkedinJson } from "../ai/generate-linkedin-json";
import { hasEvidenceForTopic } from "../lib/claim-safety";
import { toPrismaJson } from "../lib/json-parsers";
import {
  getActiveGrowthProfile,
  isContentFormat,
  isPostObjective,
  LinkedinAccessError,
} from "../lib/permissions";
import { toIdeaView } from "../lib/views";
import type { LinkedinIdeaView } from "../types";
import { buildLinkedinIdeaContext } from "./build-linkedin-idea-context";
import { ideaFingerprint, isDuplicateIdea } from "./dedupe-linkedin-ideas";
import { recruiterRelevanceFromTopic, scoreLinkedinIdea } from "./score-linkedin-idea";

type IdeaAiOutput = {
  ideas?: Array<{
    title?: string;
    angle?: string;
    summary?: string;
    format?: string;
    objective?: string;
    pillarName?: string;
    evidenceIds?: string[];
    source?: string;
  }>;
};

export async function generateLinkedinIdeas(
  userId: string,
  body: Record<string, unknown> = {},
): Promise<LinkedinIdeaView[]> {
  const profile = await getActiveGrowthProfile(userId);
  if (!profile) throw new LinkedinAccessError("NOT_FOUND", "Activate a LinkedIn strategy before generating ideas.");

  const count = Math.min(10, Math.max(1, typeof body.count === "number" ? Math.round(body.count) : 5));
  const { career } = await buildLinkedinIdeaContext(userId);
  const existing = await prisma.linkedinContentIdea.findMany({
    where: {
      userId,
      status: { in: ["NEW", "SHORTLISTED", "DRAFTED"] },
    },
    select: { title: true, angle: true, contextFingerprint: true },
  });
  const recentPosts = await prisma.linkedinPost.findMany({
    where: { userId, status: { in: ["DRAFT", "READY", "PUBLISHED"] } },
    include: { contentIdea: true },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  const ai = await generateLinkedinJson<IdeaAiOutput>({
    taskName: "linkedin-ideas",
    systemPrompt:
      "Generate evidence-backed LinkedIn ideas. Never invent expertise. Weak evidence must stay learning-oriented. Return JSON.",
    userPrompt: JSON.stringify({
      count,
      filters: {
        pillarId: body.pillarId,
        objective: body.objective,
        format: body.format,
        audience: body.audience,
        language: body.language,
      },
      pillars: profile.pillars.map((pillar) => ({ id: pillar.id, name: pillar.name, priority: pillar.priority })),
      career,
    }),
  });

  const aiIdeas = ai.ok ? (ai.data.ideas ?? []).filter((idea) => idea.title && idea.angle && idea.summary) : [];
  const candidates = (aiIdeas.length > 0 ? aiIdeas : buildFallbackIdeas(career.verifiedSkills, profile.pillars) ?? [])
    .filter((idea) => idea.title && idea.angle && idea.summary)
    .slice(0, count);

  const created: LinkedinIdeaView[] = [];
  for (const candidate of candidates) {
    const title = candidate.title!.trim();
    const angle = candidate.angle!.trim();
    const topic = `${title} ${angle}`;
    const evidence = hasEvidenceForTopic(career, title) ?? career.evidence[0] ?? null;
    const evidenceStrength = evidence?.strength ?? "WEAK";
    if (evidenceStrength === "WEAK" && /mastered|expert|senior/i.test(topic)) {
      continue;
    }
    const fingerprint = ideaFingerprint(title, angle, career.fingerprint);
    const against = [
      ...existing,
      ...recentPosts.map((post) => ({
        title: post.contentIdea?.title ?? post.objective,
        angle: post.contentIdea?.angle ?? post.format,
        contextFingerprint: post.contentIdea?.contextFingerprint ?? null,
      })),
    ];
    if (isDuplicateIdea({ title, angle, fingerprint }, against)) continue;

    const pillar =
      profile.pillars.find((item) => item.id === body.pillarId) ??
      profile.pillars.find((item) => item.name.toLowerCase() === candidate.pillarName?.toLowerCase()) ??
      profile.pillars[0];
    const score = scoreLinkedinIdea({
      context: career,
      title,
      evidenceStrength,
      pillarMatch: Boolean(pillar),
      audienceMatch: true,
      freshness: "fresh",
    });

    const row = await prisma.linkedinContentIdea.create({
      data: {
        userId,
        linkedinGrowthProfileId: profile.id,
        pillarId: pillar?.id ?? null,
        title,
        angle,
        summary: candidate.summary!.trim(),
        format: isContentFormat(candidate.format)
          ? candidate.format
          : isContentFormat(body.format)
            ? body.format
            : "TEXT_POST",
        objective: isPostObjective(candidate.objective)
          ? candidate.objective
          : isPostObjective(body.objective)
            ? body.objective
            : "SHOW_LEARNING",
        audience: typeof body.audience === "string" ? body.audience : "Hiring managers",
        sourceContextJson: toPrismaJson({ source: candidate.source ?? "EVERGREEN_STRATEGY" }),
        evidenceJson: toPrismaJson(evidence ? [evidence] : []),
        evidenceStrength,
        recruiterRelevance: recruiterRelevanceFromTopic(career, topic),
        timeliness: "EVERGREEN",
        priorityScore: score.total,
        contextFingerprint: fingerprint,
        status: "NEW",
      },
      include: { pillar: true },
    });
    existing.push({ title, angle, contextFingerprint: fingerprint });
    created.push(toIdeaView(row, row.summary));
  }

  return created;
}

function buildFallbackIdeas(
  skills: string[],
  pillars: Array<{ name: string }>,
): IdeaAiOutput["ideas"] {
  const topics = skills.slice(0, 5);
  while (topics.length < 5) topics.push("career progress");
  return topics.map((skill, index) => ({
    title: `What I learned while practicing ${skill}`,
    angle: "Learning note, not an expertise claim",
    summary: `A grounded post about recent practice with ${skill}, based on verified CareerOS evidence.`,
    format: index % 2 === 0 ? "LESSON_LEARNED" : "TEXT_POST",
    objective: "SHOW_LEARNING",
    pillarName: pillars[index % pillars.length]?.name,
    source: "SKILL",
  }));
}
