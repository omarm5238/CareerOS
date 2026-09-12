import { detectUnsupportedClaims } from "../lib/claim-safety";
import { LinkedinAccessError } from "../lib/permissions";
import { createLinkedinRevision } from "./create-linkedin-revision";
import { getLinkedinPost } from "./get-linkedin-post";
import { runLinkedinPostQa } from "./run-linkedin-post-qa";

export async function repairLinkedinPost(userId: string, postId: string) {
  const post = await getLinkedinPost(userId, postId);
  if (!post.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "Repair requires an active revision.");
  }

  const repairedBody = post.activeRevision.body
    .replace(/\bI increased (system )?performance by \d+%\./gi, "I am documenting a performance investigation I can actually support.")
    .replace(/\bI am AWS Certified\./gi, "I am studying cloud fundamentals and will only claim a certification after it is verified.")
    .replace(/\bI was a Senior Engineer\./gi, "I am positioning my current verified experience without a seniority claim.")
    .replace(/\bI led (a team of )?\d+ engineers\./gi, "I collaborated closely with other engineers on the work I can evidence.")
    .replace(/\bI worked with Google\./gi, "I am not claiming an employer or client relationship that CareerOS cannot verify.");

  await createLinkedinRevision({
    userId,
    postId,
    source: "USER_EDITED",
    hook: post.activeRevision.hook.replace(/\b(senior engineer|aws certified)\b/gi, "working note"),
    body: repairedBody,
    cta: post.activeRevision.cta,
    evidence: post.activeRevision.evidence,
    warnings: detectUnsupportedClaims(`${post.activeRevision.hook}\n${repairedBody}`, post.activeRevision.evidence),
    sourceContextSnapshot: { repairedFrom: post.activeRevision.id },
    aiSource: "repair",
  });

  const next = await getLinkedinPost(userId, postId);
  const qa = await runLinkedinPostQa(userId, postId);
  return { post: next, qa };
}
