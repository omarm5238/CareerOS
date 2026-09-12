import { LinkedinAccessError } from "../lib/permissions";
import { createLinkedinRevision } from "./create-linkedin-revision";
import { getLinkedinPost } from "./get-linkedin-post";

export async function editLinkedinPost(userId: string, postId: string, body: Record<string, unknown>) {
  const current = await getLinkedinPost(userId, postId);
  if (!current.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "This post has no active revision to edit.");
  }
  const hook = typeof body.hook === "string" ? body.hook : current.activeRevision.hook;
  const postBody = typeof body.body === "string" ? body.body : current.activeRevision.body;
  await createLinkedinRevision({
    userId,
    postId,
    source: "USER_EDITED",
    hook,
    body: postBody,
    cta: typeof body.cta === "string" ? body.cta : current.activeRevision.cta,
    tone: typeof body.tone === "string" ? body.tone : current.activeRevision.tone,
    language: typeof body.language === "string" ? body.language : current.activeRevision.language,
    hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((item): item is string => typeof item === "string") : current.activeRevision.hashtags,
    evidence: current.activeRevision.evidence,
    warnings: current.activeRevision.warnings,
    sourceContextSnapshot: { previousRevisionId: current.activeRevision.id },
    aiSource: "user",
  });
  return getLinkedinPost(userId, postId);
}

export async function regenerateLinkedinPost(userId: string, postId: string) {
  const current = await getLinkedinPost(userId, postId);
  if (!current.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "This post has no active revision to regenerate.");
  }
  const { generateLinkedinJson } = await import("../ai/generate-linkedin-json");
  const ai = await generateLinkedinJson<{ hook?: string; body?: string; cta?: string; hashtags?: string[] }>({
    taskName: "linkedin-post-regenerate",
    systemPrompt: "Rewrite the LinkedIn post without inventing facts. Keep the same evidence. Avoid clichés.",
    userPrompt: JSON.stringify({
      hook: current.activeRevision.hook,
      body: current.activeRevision.body,
      evidence: current.activeRevision.evidence,
    }),
  });
  if (!ai.ok) {
    return current;
  }
  await createLinkedinRevision({
    userId,
    postId,
    source: "REGENERATED",
    hook: ai.data.hook || current.activeRevision.hook,
    body: ai.data.body || current.activeRevision.body,
    cta: ai.data.cta ?? current.activeRevision.cta,
    hashtags: ai.data.hashtags ?? current.activeRevision.hashtags,
    evidence: current.activeRevision.evidence,
    sourceContextSnapshot: { previousRevisionId: current.activeRevision.id },
    aiSource: "openai",
    model: ai.model,
  });
  return getLinkedinPost(userId, postId);
}
