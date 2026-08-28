import type {
  ApplicationInsightType,
  ApplicationStatus,
} from "@/generated/prisma/client";

import type {
  ApplicationDocumentItem,
  ApplicationInsightContent,
} from "../types";

export type ApplicationAiJobContext = {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  descriptionTruncated: boolean;
  matchScore: number | null;
  roleAlignment: string | null;
  matchedSkills: string[];
  missingSkills: string[];
};

export type ApplicationAiResumeContext = {
  resumeVersionTitle: string | null;
  revisionNumber: number | null;
  alignmentScoreAfter: number | null;
  summary: string | null;
  coreSkills: string[];
  experienceBullets: string[];
  projects: string[];
  /** Job keywords with no supporting evidence in the submitted revision. */
  unsupportedKeywords: string[];
  /** Claims the resume engine judged safe to use. */
  supportedEvidence: string[];
  available: boolean;
};

export type ApplicationAiTimelineEntry = {
  type: string;
  title: string;
  eventAt: string;
};

export type ApplicationAiContext = {
  applicationId: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  followUpAt: string | null;
  daysSinceApplied: number | null;
  job: ApplicationAiJobContext;
  resume: ApplicationAiResumeContext;
  timeline: ApplicationAiTimelineEntry[];
  contacts: { name: string; role: string | null }[];
  notes: string | null;
  companyNotes: string | null;
  documents: ApplicationDocumentItem[];
  confirmedRejectionReason: string | null;
  confirmedRejectionSource: string | null;
  upcomingEventAt: string | null;
};

export type ApplicationInsightResolution<TContent = ApplicationInsightContent> = {
  type: ApplicationInsightType;
  content: TContent;
  source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
  model: string | null;
  aiSource: string;
  warnings: string[];
};
