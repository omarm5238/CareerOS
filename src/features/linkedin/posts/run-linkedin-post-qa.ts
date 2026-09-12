import { prisma } from "@/server/db/prisma";

import { detectUnsupportedClaims } from "../lib/claim-safety";
import { sha1Fingerprint } from "../lib/fingerprint";
import { LinkedinAccessError } from "../lib/permissions";
import { getLinkedinPost } from "./get-linkedin-post";
import { getLinkedinStrategy } from "../strategy/get-linkedin-strategy";

export async function runLinkedinPostQa(userId: string, postId: string) {
  const post = await getLinkedinPost(userId, postId);
  if (!post.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "QA requires an active revision.");
  }
  const strategy = await getLinkedinStrategy(userId);
  const fingerprint = sha1Fingerprint(
    JSON.stringify({
      revisionId: post.activeRevision.id,
      hook: post.activeRevision.hook,
      body: post.activeRevision.body,
      evidence: post.activeRevision.evidence,
      positioning: strategy?.positioningStatement ?? null,
    }),
  );

  if (post.activeRevision.qaFingerprint === fingerprint && post.activeRevision.qaStatus) {
    return {
      status: post.activeRevision.qaStatus,
      fingerprint,
      reused: true,
      warnings: post.activeRevision.warnings,
    };
  }

  const warnings = detectUnsupportedClaims(
    `${post.activeRevision.hook}\n${post.activeRevision.body}\n${post.activeRevision.cta ?? ""}`,
    post.activeRevision.evidence,
  );
  const blockedCodes = new Set([
    "unsupported_metric",
    "unsupported_certification",
    "unsupported_seniority",
    "unsupported_leadership",
    "unsupported_employer",
  ]);
  const status = warnings.some((item) => blockedCodes.has(item.code))
    ? "BLOCKED"
    : warnings.length > 0
      ? "NEEDS_REVIEW"
      : "PASS";

  await prisma.linkedinPostRevision.update({
    where: { id: post.activeRevision.id },
    data: {
      qaStatus: status,
      qaFingerprint: fingerprint,
    },
  });

  return { status, fingerprint, reused: false, warnings };
}
