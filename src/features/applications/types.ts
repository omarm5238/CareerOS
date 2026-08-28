/**
 * Application Tracker v2 — structured shapes for Milestone 22.
 *
 * Applications are first-class career execution objects. These types describe
 * both the JSON stored in Prisma columns and the view models rendered by the UI.
 */

import type {
  ApplicationEventSource,
  ApplicationEventType,
  ApplicationInsightSource,
  ApplicationInsightType,
  ApplicationNextActionSource,
  ApplicationNextActionType,
  ApplicationRejectionSource,
  ApplicationSource,
  ApplicationStatus,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Context snapshot
// ---------------------------------------------------------------------------

export type ApplicationSnapshotJob = {
  jobPostingId: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  jobUrl: string | null;
  source: string | null;
  description: string | null;
};

export type ApplicationSnapshotJobAnalysis = {
  jobAnalysisId: string | null;
  matchScore: number | null;
  roleAlignment: string | null;
  matchedSkills: string[];
  missingSkills: string[];
};

export type ApplicationSnapshotResume = {
  resumeVersionId: string | null;
  resumeVersionTitle: string | null;
  resumeVersionRevisionId: string | null;
  revisionNumber: number | null;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
};

export type ApplicationContextSnapshot = {
  job: ApplicationSnapshotJob;
  jobAnalysis: ApplicationSnapshotJobAnalysis;
  resume: ApplicationSnapshotResume;
  /** Set when the snapshot was finalized at submission time. */
  submittedAt?: string | null;
};

export const EMPTY_APPLICATION_SNAPSHOT: ApplicationContextSnapshot = {
  job: {
    jobPostingId: null,
    title: null,
    company: null,
    location: null,
    jobUrl: null,
    source: null,
    description: null,
  },
  jobAnalysis: {
    jobAnalysisId: null,
    matchScore: null,
    roleAlignment: null,
    matchedSkills: [],
    missingSkills: [],
  },
  resume: {
    resumeVersionId: null,
    resumeVersionTitle: null,
    resumeVersionRevisionId: null,
    revisionNumber: null,
    alignmentScoreBefore: null,
    alignmentScoreAfter: null,
  },
  submittedAt: null,
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type ApplicationDocumentStatus = "needed" | "ready" | "submitted";

/** AI_SUGGESTED must stay visually distinct from employer-confirmed requirements. */
export type ApplicationDocumentSource =
  | "EMPLOYER_CONFIRMED"
  | "USER_ADDED"
  | "AI_SUGGESTED";

export type ApplicationDocumentItem = {
  label: string;
  status: ApplicationDocumentStatus;
  source: ApplicationDocumentSource;
  note?: string;
};

export const APPLICATION_DOCUMENT_STATUSES = [
  "needed",
  "ready",
  "submitted",
] as const satisfies readonly ApplicationDocumentStatus[];

export const APPLICATION_DOCUMENT_SOURCES = [
  "EMPLOYER_CONFIRMED",
  "USER_ADDED",
  "AI_SUGGESTED",
] as const satisfies readonly ApplicationDocumentSource[];

// ---------------------------------------------------------------------------
// Event metadata
// ---------------------------------------------------------------------------

export type ApplicationEventMetadata = {
  round?: string;
  format?: string;
  url?: string;
  location?: string;
  notes?: string;
};

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type ApplicationNextAction = {
  type: ApplicationNextActionType | null;
  title: string | null;
  reason: string | null;
  dueAt: string | null;
  source: ApplicationNextActionSource | null;
};

export type ApplicationResumeLink = {
  resumeVersionId: string | null;
  resumeVersionTitle: string | null;
  resumeVersionStatus: string | null;
  resumeVersionRevisionId: string | null;
  revisionNumber: number | null;
  alignmentScoreAfter: number | null;
  /** True when the underlying resume records still exist in the database. */
  recordAvailable: boolean;
};

export type ApplicationUpcomingEvent = {
  id: string;
  type: ApplicationEventType;
  title: string;
  description: string | null;
  eventAt: string;
  metadata: ApplicationEventMetadata;
};

export type ApplicationTimelineItem = {
  id: string;
  type: ApplicationEventType;
  source: ApplicationEventSource;
  title: string;
  description: string | null;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  eventAt: string;
  createdAt: string;
  metadata: ApplicationEventMetadata;
};

export type ApplicationContactView = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationContactInput = {
  name: string;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
};

export type ApplicationListItem = {
  id: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  jobPostingId: string | null;
  jobTitle: string;
  company: string;
  appliedAt: string | null;
  followUpAt: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  nextAction: ApplicationNextAction;
  resume: ApplicationResumeLink;
  upcomingEvent: ApplicationUpcomingEvent | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationDetail = {
  id: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  jobPostingId: string | null;
  jobTitle: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  /** True when the source jobPosting row still exists. */
  jobRecordAvailable: boolean;
  appliedAt: string | null;
  followUpAt: string | null;
  lastActivityAt: string;
  rejectedAt: string | null;
  closedAt: string | null;
  nextAction: ApplicationNextAction;
  resume: ApplicationResumeLink;
  notes: string | null;
  companyNotes: string | null;
  salaryNotes: string | null;
  documents: ApplicationDocumentItem[];
  confirmedRejectionReason: string | null;
  confirmedRejectionSource: ApplicationRejectionSource | null;
  snapshot: ApplicationContextSnapshot;
  timeline: ApplicationTimelineItem[];
  contacts: ApplicationContactView[];
  upcomingEvent: ApplicationUpcomingEvent | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationMetrics = {
  active: number;
  needsAction: number;
  upcoming: number;
  offers: number;
};

// ---------------------------------------------------------------------------
// Insight content shapes
// ---------------------------------------------------------------------------

export type ApplicationInsightConfidence = "low" | "medium" | "high";

export type ApplicationInsightPriority = "low" | "medium" | "high";

export type ApplicationNextActionContent = {
  type: ApplicationNextActionType;
  title: string;
  reason: string;
  priority: ApplicationInsightPriority;
  dueAt: string | null;
  evidence: string[];
  warnings: string[];
};

export type ApplicationLikelyQuestion = {
  question: string;
  whyLikely: string;
  evidenceToUse: string;
};

export type ApplicationStagePrep = {
  stage: "SCREENING" | "ASSESSMENT" | "INTERVIEW" | "OFFER";
  summary: string;
  focusAreas: string[];
  likelyQuestions: ApplicationLikelyQuestion[];
  evidenceToEmphasize: string[];
  risks: string[];
  questionsToAsk: string[];
  checklist: string[];
  warnings: string[];
};

export type ApplicationLikelyFactor = {
  factor: string;
  evidence: string;
  confidence: ApplicationInsightConfidence;
};

export type ApplicationRejectionAnalysis = {
  /** Mirrors the user-entered confirmed fact. AI inference never lands here. */
  confirmedReason: string | null;
  likelyFactors: ApplicationLikelyFactor[];
  whatWorked: string[];
  lessons: string[];
  resumeChanges: string[];
  skillActions: string[];
  nextActions: string[];
  warnings: string[];
};

export type ApplicationInsightContent =
  | ApplicationNextActionContent
  | ApplicationStagePrep
  | ApplicationRejectionAnalysis;

export type ApplicationInsightDetail<TContent = ApplicationInsightContent> = {
  id: string;
  type: ApplicationInsightType;
  source: ApplicationInsightSource;
  content: TContent;
  model: string | null;
  aiSource: string | null;
  warnings: string[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const APPLICATION_FILTERS = [
  "active",
  "needs-action",
  "interviews",
  "closed",
  "all",
] as const;

export type ApplicationFilter = (typeof APPLICATION_FILTERS)[number];

export const APPLICATION_FILTER_LABELS: Record<ApplicationFilter, string> = {
  active: "Active",
  "needs-action": "Needs Action",
  interviews: "Interviews",
  closed: "Closed",
  all: "All",
};

/** Statuses treated as live pipeline work. */
export const ACTIVE_APPLICATION_STATUSES = [
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
] as const satisfies readonly ApplicationStatus[];

export const CLOSED_APPLICATION_STATUSES = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const satisfies readonly ApplicationStatus[];

/** Scheduled meeting events used by the upcoming-window metric. */
export const SCHEDULED_EVENT_TYPES = [
  "SCREENING_SCHEDULED",
  "ASSESSMENT_SCHEDULED",
  "INTERVIEW_SCHEDULED",
] as const satisfies readonly ApplicationEventType[];

export const UPCOMING_WINDOW_DAYS = 7;
