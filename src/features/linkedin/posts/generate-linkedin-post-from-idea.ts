import { prisma } from "@/server/db/prisma";

import { generateLinkedinJson } from "../ai/generate-linkedin-json";
import { detectUnsupportedClaims } from "../lib/claim-safety";
import { parseEvidenceItems } from "../lib/json-parsers";
import { assertOwnedIdea, LinkedinAccessError } from "../lib/permissions";
import { createLinkedinPost } from "./create-linkedin-post";
import { createLinkedinRevision } from "./create-linkedin-revision";
import { getLinkedinPost } from "./get-linkedin-post";

type PostAiOutput = {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  warnings?: string[];
};

export async function generateLinkedinPostFromIdea(userId: string, ideaId: string) {
  const idea = await assertOwnedIdea(userId, ideaId);
  const evidence = parseEvidenceItems(idea.evidenceJson);
  const post = await createLinkedinPost(userId, {
    ideaId: idea.id,
    pillarId: idea.pillarId ?? undefined,
    objective: idea.objective,
    format: idea.format,
    intendedAudience: idea.audience ?? undefined,
  });

  const ai = await generateLinkedinJson<PostAiOutput>({
    taskName: "linkedin-post-from-idea",
    systemPrompt:
      "Write a factual LinkedIn post. Avoid clichés. Do not invent metrics, employers, seniority, or certifications. Return JSON with hook, body, cta, hashtags, warnings.",
    userPrompt: JSON.stringify({
      idea: { title: idea.title, angle: idea.angle, summary: idea.summary, format: idea.format },
      evidence,
    }),
    temperature: 0.35,
  });

  const fallback = {
    hook: idea.title,
    body: `${idea.summary}\n\nI am sharing this as a learning note grounded in work I can actually point to, not as a claim of mastery.`,
    cta: "If you are hiring for this kind of work, I am happy to compare notes.",
    hashtags: [],
  };
  const payload = ai.ok ? { ...fallback, ...ai.data } : fallback;
  const warnings = detectUnsupportedClaims(
    `${payload.hook}\n${payload.body}\n${payload.cta ?? ""}`,
    evidence,
  );

  await createLinkedinRevision({
    userId,
    postId: post.id,
    source: ai.ok ? "AI_GENERATED" : "RULE_BASED_FALLBACK",
    hook: payload.hook,
    body: payload.body,
    cta: payload.cta,
    hashtags: (payload.hashtags ?? []).slice(0, 3),
    evidence,
    warnings,
    sourceContextSnapshot: { ideaId: idea.id, title: idea.title },
    aiSource: ai.ok ? "openai" : "fallback",
    model: ai.ok ? ai.model : null,
  });

  await prisma.linkedinContentIdea.update({
    where: { id: idea.id },
    data: { status: "DRAFTED" },
  });

  return getLinkedinPost(userId, post.id);
}

export async function generateLinkedinPostFromBrief(userId: string, body: Record<string, unknown>) {
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) throw new LinkedinAccessError("INVALID_INPUT", "A post brief is required.");
  const post = await createLinkedinPost(userId, {
    objective: typeof body.objective === "string" ? body.objective : undefined,
    format: typeof body.format === "string" ? body.format : undefined,
    intendedAudience: typeof body.audience === "string" ? body.audience : undefined,
    pillarId: typeof body.pillarId === "string" ? body.pillarId : undefined,
  });

  const ai = await generateLinkedinJson<PostAiOutput>({
    taskName: "linkedin-post-from-brief",
    systemPrompt:
      "Write a factual LinkedIn post from the user brief. Do not invent professional facts. Avoid generic LinkedIn clichés.",
    userPrompt: brief,
  });
  const fallback = {
    hook: brief.slice(0, 80),
    body: brief,
    cta: null as string | null,
    hashtags: [] as string[],
  };
  const payload = ai.ok ? { ...fallback, ...ai.data } : fallback;
  await createLinkedinRevision({
    userId,
    postId: post.id,
    source: ai.ok ? "AI_GENERATED" : "RULE_BASED_FALLBACK",
    hook: payload.hook || "Working note",
    body: payload.body || brief,
    cta: payload.cta,
    hashtags: payload.hashtags,
    warnings: detectUnsupportedClaims(`${payload.hook}\n${payload.body}`, []),
    sourceContextSnapshot: { brief },
    aiSource: ai.ok ? "openai" : "fallback",
    model: ai.ok ? ai.model : null,
  });
  return getLinkedinPost(userId, post.id);
}
