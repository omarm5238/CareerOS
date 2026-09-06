import { createHash } from "node:crypto";

import type { CommunicationContext } from "../types";

/**
 * Stable fingerprint of the facts that should invalidate a communication draft.
 * Draft/revision write timestamps are excluded so viewing or saving never
 * marks the same facts as stale.
 */
export function buildCommunicationContextFingerprint(context: CommunicationContext): string {
  const canonical = {
    type: context.settings.type,
    tone: context.settings.tone,
    length: context.settings.length,
    language: context.settings.language,
    offerIntent: context.settings.offerIntent,
    recipientMode: context.settings.recipientMode,
    contactId: context.contact.id,
    contactName: context.contact.name,
    contactRole: context.contact.role,
    contactEmail: context.contact.email,
    applicationId: context.application?.id ?? null,
    applicationStatus: context.application?.status ?? null,
    appliedAt: context.application?.appliedAt ?? null,
    notes: context.application?.notes ?? null,
    companyNotes: context.application?.companyNotes ?? null,
    salaryNotes: context.application?.salaryNotes ?? null,
    confirmedRejectionReason: context.application?.confirmedRejectionReason ?? null,
    interviewCompleted: context.application?.interviewCompleted ?? false,
    interviewCompletedAt: context.application?.interviewCompletedAt ?? null,
    offerReceived: context.application?.offerReceived ?? false,
    followUpSentCount: context.application?.followUpSentCount ?? 0,
    resumeRevisionId: context.resume.revisionId,
    jobAnalysisId: context.jobAnalysis.id,
    jobAnalysisUpdatedAt: context.jobAnalysis.updatedAt,
    jobTitle: context.job.title,
    company: context.job.company,
    timeline: context.timeline.map((event) => `${event.type}|${event.eventAt}|${event.title}`),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 40);
}

export function toCommunicationContextSnapshot(context: CommunicationContext) {
  return {
    application: {
      id: context.application?.id ?? null,
      status: context.application?.status ?? null,
      appliedAt: context.application?.appliedAt ?? null,
      latestRelevantEvents: context.timeline.slice(0, 8),
    },
    job: {
      id: context.job.id,
      title: context.job.title,
      company: context.job.company,
      location: context.job.location,
    },
    jobAnalysis: {
      id: context.jobAnalysis.id,
      matchScore: context.jobAnalysis.matchScore,
      requirements: context.jobAnalysis.requirements.slice(0, 8),
      matchedSkills: context.jobAnalysis.matchedSkills.slice(0, 8),
      gaps: context.jobAnalysis.gaps.slice(0, 8),
    },
    resume: {
      versionId: context.resume.versionId,
      revisionId: context.resume.revisionId,
      revisionNumber: context.resume.revisionNumber,
      alignmentScore: context.resume.alignmentScore,
    },
    contact: {
      id: context.contact.id,
      name: context.contact.name,
      role: context.contact.role,
    },
    settings: {
      type: context.settings.type,
      tone: context.settings.tone,
      length: context.settings.length,
      language: context.settings.language,
      offerIntent: context.settings.offerIntent,
      recipientMode: context.settings.recipientMode,
    },
  };
}
