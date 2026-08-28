import { createHash } from "node:crypto";

import type { ApplicationInsightType } from "@/generated/prisma/client";

import type { ApplicationAiContext } from "./types";

/**
 * Stable cache key for a generated insight.
 *
 * Only facts that should invalidate advice are folded in. `updatedAt` is
 * deliberately excluded: storing an insight bumps the application row, so using
 * it here would invalidate the cache on every write and loop forever.
 */
export function buildApplicationContextFingerprint(
  type: ApplicationInsightType,
  context: ApplicationAiContext,
): string {
  const canonical = {
    type,
    status: context.status,
    appliedAt: context.appliedAt,
    followUpAt: context.followUpAt,
    jobTitle: context.job.title,
    company: context.job.company,
    matchScore: context.job.matchScore,
    roleAlignment: context.job.roleAlignment,
    matchedSkills: [...context.job.matchedSkills].sort(),
    missingSkills: [...context.job.missingSkills].sort(),
    resumeRevisionNumber: context.resume.revisionNumber,
    resumeVersionTitle: context.resume.resumeVersionTitle,
    resumeAlignment: context.resume.alignmentScoreAfter,
    unsupportedKeywords: [...context.resume.unsupportedKeywords].sort(),
    confirmedRejectionReason: context.confirmedRejectionReason,
    confirmedRejectionSource: context.confirmedRejectionSource,
    notes: context.notes,
    companyNotes: context.companyNotes,
    contacts: context.contacts.map((contact) => `${contact.name}|${contact.role ?? ""}`).sort(),
    documents: context.documents.map((doc) => `${doc.label}|${doc.status}|${doc.source}`).sort(),
    // Timeline shape, not timestamps of when CareerOS recorded them.
    timeline: context.timeline.map((entry) => `${entry.type}|${entry.eventAt}`),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 40);
}
