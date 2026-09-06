import { prisma } from "@/server/db/prisma";

import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";
import type { ApplicationEventType } from "@/generated/prisma/client";

import {
  EMPTY_CONTACT_FACTS,
  EMPTY_JOB_ANALYSIS_FACTS,
  EMPTY_JOB_FACTS,
  EMPTY_RESUME_FACTS,
  type CommunicationContext,
  type CommunicationGenerationInput,
  type CommunicationJobAnalysisFacts,
  type CommunicationResumeFacts,
} from "../types";
import {
  assertApplicationOwnedByUser,
  assertContactOwnedForApplication,
  assertJobOwnedByUser,
  assertResumeRevisionOwnedByUser,
  CommunicationAccessError,
  isCommunicationLanguage,
  isCommunicationLength,
  isCommunicationTone,
  isCommunicationType,
  isOfferResponseIntent,
  isRecipientMode,
} from "./communication-permissions";
import { isRecord } from "./json-parsers";

const NOTE_LIMIT = 1_200;
const LIST_LIMIT = 8;
const TIMELINE_LIMIT = 12;

function truncate(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trimEnd()}…` : trimmed;
}

function asStringArray(value: unknown, limit = LIST_LIMIT): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseDocuments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => (typeof item.label === "string" ? item.label.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

async function loadUserIdentity(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return {
    name: user?.name?.trim() || null,
    email: user?.email?.trim() || null,
  };
}

async function loadJobAnalysis(jobPostingId: string): Promise<CommunicationJobAnalysisFacts> {
  const analysis = await prisma.jobAnalysis.findFirst({
    where: { jobPostingId },
    select: {
      id: true,
      updatedAt: true,
      matchScore: true,
      roleAlignment: true,
      matchedSkills: true,
      missingSkills: true,
      jobSignals: true,
    },
  });

  if (!analysis) return { ...EMPTY_JOB_ANALYSIS_FACTS };

  return {
    id: analysis.id,
    updatedAt: analysis.updatedAt.toISOString(),
    matchScore: analysis.matchScore,
    roleAlignment: analysis.roleAlignment,
    requirements: asStringArray(analysis.jobSignals),
    matchedSkills: asStringArray(analysis.matchedSkills),
    gaps: asStringArray(analysis.missingSkills),
  };
}

async function loadExactResumeFacts(
  userId: string,
  resumeVersionId: string | null,
  resumeVersionRevisionId: string | null,
): Promise<CommunicationResumeFacts> {
  if (!resumeVersionId || !resumeVersionRevisionId) {
    return { ...EMPTY_RESUME_FACTS };
  }

  const { version, revision } = await assertResumeRevisionOwnedByUser(
    userId,
    resumeVersionId,
    resumeVersionRevisionId,
  );

  const content = parseResumeVersionContent(revision.contentJson);
  const experiencePoints = content.experienceBullets
    .map((item) => item.tailored?.trim() || item.original?.trim() || "")
    .filter(Boolean)
    .slice(0, 4);
  const projects = content.projects
    .map((item) => item.tailored?.trim() || item.original?.trim() || "")
    .filter(Boolean)
    .slice(0, 3);

  return {
    versionId: version.id,
    versionTitle: version.title,
    versionStatus: version.status,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    alignmentScore: revision.alignmentScoreAfter,
    summary: truncate(content.summary, 600),
    coreSkills: content.coreSkills.slice(0, 8),
    experiencePoints,
    projects,
  };
}

function resolveSettings(input: CommunicationGenerationInput): CommunicationContext["settings"] {
  if (!isCommunicationType(input.type)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid communication type.");
  }

  const recipientMode = input.recipientMode ?? "UNKNOWN";
  if (!isRecipientMode(recipientMode)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid recipient mode.");
  }

  const tone = input.tone ?? "PROFESSIONAL";
  const length = input.length ?? (input.type === "FOLLOW_UP" || input.type === "RECRUITER_OUTREACH"
    ? "SHORT"
    : "STANDARD");
  const language = input.language ?? "ENGLISH";

  if (!isCommunicationTone(tone)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid tone.");
  }
  if (!isCommunicationLength(length)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid length.");
  }
  if (!isCommunicationLanguage(language)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid language.");
  }

  let offerIntent = input.offerIntent ?? null;
  if (offerIntent !== null && !isOfferResponseIntent(offerIntent)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Provide a valid offer response intent.");
  }
  if (input.type === "OFFER_RESPONSE" && !offerIntent) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "Choose an offer response intent before generating.",
    );
  }
  if (input.type !== "OFFER_RESPONSE") {
    offerIntent = null;
  }

  return {
    type: input.type,
    tone,
    length,
    language,
    offerIntent,
    recipientMode,
    interviewOccurredConfirmed: input.interviewOccurredConfirmed === true,
  };
}

export async function buildCommunicationContext(
  userId: string,
  input: CommunicationGenerationInput,
): Promise<CommunicationContext> {
  const settings = resolveSettings(input);
  const user = await loadUserIdentity(userId);

  if (input.applicationId) {
    return buildApplicationScopedContext(userId, user, input, settings);
  }

  if (!input.jobPostingId) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "Provide an application or a saved job to generate communication.",
    );
  }

  return buildJobScopedContext(userId, user, input, settings);
}

async function buildApplicationScopedContext(
  userId: string,
  user: CommunicationContext["user"],
  input: CommunicationGenerationInput,
  settings: CommunicationContext["settings"],
): Promise<CommunicationContext> {
  const applicationId = input.applicationId?.trim();
  if (!applicationId) {
    throw new CommunicationAccessError("INVALID_INPUT", "Application ID is required.");
  }

  const owned = await assertApplicationOwnedByUser(userId, applicationId);

  if (input.jobPostingId && owned.jobPostingId && input.jobPostingId !== owned.jobPostingId) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "That job does not belong to this application.",
    );
  }

  const application = await prisma.application.findFirst({
    where: { id: owned.id, userId },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      followUpAt: true,
      notes: true,
      companyNotes: true,
      salaryNotes: true,
      documentsNeededJson: true,
      confirmedRejectionReason: true,
      jobPostingId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      jobPosting: {
        select: { id: true, title: true, company: true, location: true, source: true },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          company: true,
          email: true,
          isPrimary: true,
        },
      },
      events: {
        orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
        take: TIMELINE_LIMIT,
        select: { type: true, title: true, eventAt: true },
      },
    },
  });

  if (!application) {
    throw new CommunicationAccessError("NOT_FOUND", "Application not found for this user.");
  }

  const interviewCompletedEvent = application.events.find(
    (event) => event.type === ("INTERVIEW_COMPLETED" satisfies ApplicationEventType),
  );
  const offerReceived =
    application.status === "OFFER" ||
    application.events.some((event) => event.type === "OFFER_RECEIVED");
  const followUpSentCount = application.events.filter((event) => event.type === "FOLLOW_UP_SENT")
    .length;

  if (settings.type === "INTERVIEW_THANK_YOU") {
    if (!interviewCompletedEvent && !settings.interviewOccurredConfirmed) {
      throw new CommunicationAccessError(
        "INVALID_INPUT",
        "An interview thank-you requires a completed interview event, or an explicit confirmation that the interview occurred.",
      );
    }
  }

  if (settings.type === "POST_INTERVIEW_FOLLOW_UP" && !interviewCompletedEvent) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "A post-interview follow-up requires a recorded interview completion.",
    );
  }

  if (settings.type === "OFFER_RESPONSE" && !offerReceived) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "An offer response requires the application to be in Offer stage or a recorded offer event.",
    );
  }

  let contact = { ...EMPTY_CONTACT_FACTS };
  if (settings.recipientMode === "SPECIFIC_CONTACT") {
    if (!input.contactId) {
      throw new CommunicationAccessError("INVALID_INPUT", "Select a specific contact.");
    }
    const ownedContact = await assertContactOwnedForApplication(
      userId,
      input.contactId,
      application.id,
    );
    contact = {
      id: ownedContact.id,
      name: ownedContact.name,
      role: ownedContact.role,
      company: ownedContact.company,
      email: ownedContact.email,
    };
  } else if (settings.recipientMode === "PRIMARY_CONTACT") {
    const primary =
      application.contacts.find((item) => item.isPrimary) ?? application.contacts[0] ?? null;
    if (primary) {
      contact = {
        id: primary.id,
        name: primary.name,
        role: primary.role,
        company: primary.company,
        email: primary.email,
      };
    }
  }

  const resume = await loadExactResumeFacts(
    userId,
    application.resumeVersionId,
    application.resumeVersionRevisionId,
  );

  const job = application.jobPosting
    ? {
        id: application.jobPosting.id,
        title: application.jobPosting.title,
        company: application.jobPosting.company,
        location: application.jobPosting.location,
        source: application.jobPosting.source,
      }
    : { ...EMPTY_JOB_FACTS, id: application.jobPostingId };

  const jobAnalysis = application.jobPostingId
    ? await loadJobAnalysis(application.jobPostingId)
    : { ...EMPTY_JOB_ANALYSIS_FACTS };

  return {
    user,
    application: {
      id: application.id,
      status: application.status,
      appliedAt: application.appliedAt?.toISOString() ?? null,
      followUpAt: application.followUpAt?.toISOString() ?? null,
      notes: truncate(application.notes, NOTE_LIMIT),
      companyNotes: truncate(application.companyNotes, NOTE_LIMIT),
      salaryNotes: truncate(application.salaryNotes, NOTE_LIMIT),
      documents: parseDocuments(application.documentsNeededJson),
      confirmedRejectionReason: truncate(application.confirmedRejectionReason, 400),
      interviewCompleted: Boolean(interviewCompletedEvent) || settings.interviewOccurredConfirmed,
      interviewCompletedAt: interviewCompletedEvent?.eventAt.toISOString() ?? null,
      offerReceived,
      followUpSentCount,
    },
    job,
    jobAnalysis,
    resume,
    contact,
    timeline: application.events.map((event) => ({
      type: event.type,
      title: event.title,
      eventAt: event.eventAt.toISOString(),
    })),
    settings,
  };
}

async function buildJobScopedContext(
  userId: string,
  user: CommunicationContext["user"],
  input: CommunicationGenerationInput,
  settings: CommunicationContext["settings"],
): Promise<CommunicationContext> {
  const jobPostingId = input.jobPostingId?.trim();
  if (!jobPostingId) {
    throw new CommunicationAccessError("INVALID_INPUT", "Job ID is required.");
  }

  const job = await assertJobOwnedByUser(userId, jobPostingId);
  const jobAnalysis = await loadJobAnalysis(job.id);

  if (
    settings.type === "INTERVIEW_THANK_YOU" ||
    settings.type === "POST_INTERVIEW_FOLLOW_UP" ||
    settings.type === "OFFER_RESPONSE" ||
    settings.type === "FOLLOW_UP"
  ) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "That communication type needs an application. Start an application first.",
    );
  }

  let resume = { ...EMPTY_RESUME_FACTS };
  if (input.resumeVersionId && input.resumeVersionRevisionId) {
    resume = await loadExactResumeFacts(
      userId,
      input.resumeVersionId,
      input.resumeVersionRevisionId,
    );
  } else if (input.resumeVersionId) {
    const version = await prisma.resumeVersion.findFirst({
      where: { id: input.resumeVersionId, userId, targetJobId: job.id },
      select: { id: true, activeRevisionId: true },
    });
    if (!version?.activeRevisionId) {
      throw new CommunicationAccessError(
        "INVALID_INPUT",
        "Select a resume revision for this cover letter.",
      );
    }
    resume = await loadExactResumeFacts(userId, version.id, version.activeRevisionId);
  }

  return {
    user,
    application: null,
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
    },
    jobAnalysis,
    resume,
    contact: { ...EMPTY_CONTACT_FACTS },
    timeline: [],
    settings,
  };
}

export async function rebuildCurrentContextForDraft(
  userId: string,
  draftId: string,
): Promise<CommunicationContext> {
  const draft = await prisma.communicationDraft.findFirst({
    where: { id: draftId, userId },
    select: {
      applicationId: true,
      jobPostingId: true,
      contactId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      type: true,
      activeRevision: {
        select: {
          tone: true,
          length: true,
          language: true,
          contextSnapshotJson: true,
        },
      },
    },
  });

  if (!draft) {
    throw new CommunicationAccessError("NOT_FOUND", "Communication draft not found.");
  }

  const snapshot = isRecord(draft.activeRevision?.contextSnapshotJson)
    ? draft.activeRevision.contextSnapshotJson
    : {};
  const settingsRecord = isRecord(snapshot.settings) ? snapshot.settings : {};

  return buildCommunicationContext(userId, {
    applicationId: draft.applicationId,
    jobPostingId: draft.jobPostingId,
    contactId: draft.contactId,
    resumeVersionId: draft.resumeVersionId,
    resumeVersionRevisionId: draft.resumeVersionRevisionId,
    type: draft.type,
    tone: draft.activeRevision?.tone,
    length: draft.activeRevision?.length,
    language: draft.activeRevision?.language,
    recipientMode: isRecipientMode(settingsRecord.recipientMode)
      ? settingsRecord.recipientMode
      : draft.contactId
        ? "SPECIFIC_CONTACT"
        : "UNKNOWN",
    offerIntent: isOfferResponseIntent(settingsRecord.offerIntent)
      ? settingsRecord.offerIntent
      : null,
  });
}
