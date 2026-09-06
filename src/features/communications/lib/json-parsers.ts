import type { Prisma } from "@/generated/prisma/client";

import {
  COMMUNICATION_EVIDENCE_SOURCES,
  COMMUNICATION_LANGUAGES,
  COMMUNICATION_LENGTHS,
  COMMUNICATION_TONES,
  COMMUNICATION_TYPES,
  EMPTY_CONTACT_FACTS,
  OFFER_RESPONSE_INTENTS,
  RECIPIENT_MODES,
  type CommunicationChangeLogItem,
  type CommunicationContextSnapshot,
  type CommunicationEvidenceItem,
  type CommunicationEvidenceSource,
  type CommunicationWarning,
  type OfferResponseIntent,
  type RecipientMode,
} from "../types";
import type {
  ApplicationStatus,
  CommunicationLanguage,
  CommunicationLength,
  CommunicationTone,
  CommunicationType,
} from "@/generated/prisma/client";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function parseEvidenceUsed(value: unknown): CommunicationEvidenceItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => {
      const label = (asString(item.label) ?? "").trim();
      const source = asEnum<CommunicationEvidenceSource>(
        item.source,
        COMMUNICATION_EVIDENCE_SOURCES,
      );
      if (!label || !source) return null;
      return { label: label.slice(0, 180), source };
    })
    .filter((item): item is CommunicationEvidenceItem => item !== null)
    .slice(0, 8);
}

export function parseWarnings(value: unknown): CommunicationWarning[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const message = item.trim();
        return message ? { code: "general", message: message.slice(0, 240) } : null;
      }
      if (!isRecord(item)) return null;
      const message = (asString(item.message) ?? "").trim();
      if (!message) return null;
      return {
        code: (asString(item.code) ?? "general").slice(0, 64),
        message: message.slice(0, 240),
      };
    })
    .filter((item): item is CommunicationWarning => item !== null)
    .slice(0, 10);
}

export function parseChangeLog(value: unknown): CommunicationChangeLogItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => {
      const action = (asString(item.action) ?? "").trim();
      const detail = (asString(item.detail) ?? "").trim();
      if (!action && !detail) return null;
      return {
        action: (action || "update").slice(0, 80),
        detail: (detail || action).slice(0, 240),
      };
    })
    .filter((item): item is CommunicationChangeLogItem => item !== null)
    .slice(0, 8);
}

export function parseContextSnapshot(value: unknown): CommunicationContextSnapshot {
  const empty: CommunicationContextSnapshot = {
    application: {
      id: null,
      status: null,
      appliedAt: null,
      latestRelevantEvents: [],
    },
    job: { id: null, title: null, company: null, location: null },
    jobAnalysis: {
      id: null,
      matchScore: null,
      requirements: [],
      matchedSkills: [],
      gaps: [],
    },
    resume: {
      versionId: null,
      revisionId: null,
      revisionNumber: null,
      alignmentScore: null,
    },
    contact: { id: null, name: null, role: null },
    settings: {
      type: "GENERAL_PROFESSIONAL_MESSAGE",
      tone: "PROFESSIONAL",
      length: "STANDARD",
      language: "ENGLISH",
      offerIntent: null,
      recipientMode: "UNKNOWN",
    },
  };

  if (!isRecord(value)) return empty;

  const application = isRecord(value.application) ? value.application : {};
  const job = isRecord(value.job) ? value.job : {};
  const jobAnalysis = isRecord(value.jobAnalysis) ? value.jobAnalysis : {};
  const resume = isRecord(value.resume) ? value.resume : {};
  const contact = isRecord(value.contact) ? value.contact : {};
  const settings = isRecord(value.settings) ? value.settings : {};

  const events = Array.isArray(application.latestRelevantEvents)
    ? application.latestRelevantEvents
        .filter(isRecord)
        .map((event) => ({
          type: (asString(event.type) ?? "").trim(),
          title: (asString(event.title) ?? "").trim(),
          eventAt: (asString(event.eventAt) ?? "").trim(),
        }))
        .filter((event) => event.type.length > 0)
        .slice(0, 8)
    : [];

  return {
    application: {
      id: asString(application.id),
      status: asEnum<ApplicationStatus>(application.status, [
        "DRAFT",
        "APPLIED",
        "SCREENING",
        "ASSESSMENT",
        "INTERVIEW",
        "OFFER",
        "ACCEPTED",
        "REJECTED",
        "WITHDRAWN",
      ]),
      appliedAt: asString(application.appliedAt),
      latestRelevantEvents: events,
    },
    job: {
      id: asString(job.id),
      title: asString(job.title),
      company: asString(job.company),
      location: asString(job.location),
    },
    jobAnalysis: {
      id: asString(jobAnalysis.id),
      matchScore: asNumber(jobAnalysis.matchScore),
      requirements: asStringArray(jobAnalysis.requirements, 10),
      matchedSkills: asStringArray(jobAnalysis.matchedSkills, 10),
      gaps: asStringArray(jobAnalysis.gaps, 10),
    },
    resume: {
      versionId: asString(resume.versionId),
      revisionId: asString(resume.revisionId),
      revisionNumber: asNumber(resume.revisionNumber),
      alignmentScore: asNumber(resume.alignmentScore),
    },
    contact: {
      id: asString(contact.id),
      name: asString(contact.name),
      role: asString(contact.role),
    },
    settings: {
      type:
        asEnum<CommunicationType>(settings.type, COMMUNICATION_TYPES) ??
        empty.settings.type,
      tone: asEnum<CommunicationTone>(settings.tone, COMMUNICATION_TONES) ?? "PROFESSIONAL",
      length:
        asEnum<CommunicationLength>(settings.length, COMMUNICATION_LENGTHS) ?? "STANDARD",
      language:
        asEnum<CommunicationLanguage>(settings.language, COMMUNICATION_LANGUAGES) ?? "ENGLISH",
      offerIntent: asEnum<OfferResponseIntent>(settings.offerIntent, OFFER_RESPONSE_INTENTS),
      recipientMode:
        asEnum<RecipientMode>(settings.recipientMode, RECIPIENT_MODES) ?? "UNKNOWN",
    },
  };
}

export function emptyContactFacts() {
  return { ...EMPTY_CONTACT_FACTS };
}

export function clipText(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

export function clipMultiline(value: string, maxLength: number): string {
  const cleaned = value.replace(/\r\n/g, "\n").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}
