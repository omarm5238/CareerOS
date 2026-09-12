import type { LinkedinPostRevisionSource } from "@/generated/prisma/client";

import { generateLinkedinJson } from "../ai/generate-linkedin-json";
import { isLanguage, isTransformType, LinkedinAccessError } from "../lib/permissions";
import type { LinkedinTransformType } from "../types";
import { createLinkedinRevision } from "./create-linkedin-revision";
import { getLinkedinPost } from "./get-linkedin-post";

const SOURCE_BY_TRANSFORM: Partial<Record<LinkedinTransformType, LinkedinPostRevisionSource>> = {
  SHORTEN: "SHORTENED",
  EXPAND: "EXPANDED",
  MAKE_TECHNICAL: "TONE_CHANGED",
  MAKE_CONVERSATIONAL: "TONE_CHANGED",
  IMPROVE_HOOK: "HOOK_REWRITTEN",
  RECRUITER_FOCUSED: "REPURPOSED",
  TRANSLATE: "TRANSLATED",
  ALTERNATIVE_VERSION: "REPURPOSED",
};

export async function transformLinkedinPost(userId: string, postId: string, body: Record<string, unknown>) {
  if (!isTransformType(body.type)) {
    throw new LinkedinAccessError("INVALID_INPUT", "A valid transform type is required.");
  }
  const current = await getLinkedinPost(userId, postId);
  if (!current.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "This post has no active revision to transform.");
  }

  const language = isLanguage(body.language) ? body.language : current.activeRevision.language;
  const ai = await generateLinkedinJson<{ hook?: string; body?: string; cta?: string; hashtags?: string[] }>({
    taskName: "linkedin-post-transform",
    systemPrompt: `Transform the LinkedIn post (${body.type}). Do not invent facts. Avoid clichés.`,
    userPrompt: JSON.stringify({
      type: body.type,
      language,
      hook: current.activeRevision.hook,
      body: current.activeRevision.body,
      cta: current.activeRevision.cta,
    }),
  });

  const transformed = applyLocalTransform(
    body.type,
    current.activeRevision.hook,
    current.activeRevision.body,
    current.activeRevision.cta,
  );
  const payload = {
    ...transformed,
    hashtags: current.activeRevision.hashtags,
    ...(ai.ok ? ai.data : {}),
  };

  await createLinkedinRevision({
    userId,
    postId,
    source: SOURCE_BY_TRANSFORM[body.type] ?? "REPURPOSED",
    hook: payload.hook,
    body: payload.body,
    cta: payload.cta,
    language,
    hashtags: payload.hashtags ?? current.activeRevision.hashtags,
    evidence: current.activeRevision.evidence,
    sourceContextSnapshot: { transform: body.type, previousRevisionId: current.activeRevision.id },
    aiSource: ai.ok ? "openai" : "fallback",
    model: ai.ok ? ai.model : null,
  });
  return getLinkedinPost(userId, postId);
}

function applyLocalTransform(
  type: LinkedinTransformType,
  hook: string,
  body: string,
  cta: string | null,
) {
  if (type === "SHORTEN") {
    return { hook, body: body.split("\n").slice(0, 4).join("\n"), cta };
  }
  if (type === "EXPAND") {
    return { hook, body: `${body}\n\nThe practical takeaway is to keep the next step small and evidence-based.`, cta };
  }
  if (type === "IMPROVE_HOOK") {
    return { hook: hook.replace(/^I'm thrilled to announce\s*/i, "").trim() || hook, body, cta };
  }
  if (type === "REMOVE_CLICHES") {
    return {
      hook: hook.replace(/here's the truth nobody tells you/i, "A concrete note").trim(),
      body: body.replace(/\b(agree\?|thoughts\?)\b/gi, "").trim(),
      cta,
    };
  }
  return { hook, body, cta };
}
