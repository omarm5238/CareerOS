import type {
  ApplicationStatus,
  CommunicationGenerationStatus,
  CommunicationLanguage,
  CommunicationLength,
  CommunicationRevisionSource,
  CommunicationStatus,
  CommunicationTone,
  CommunicationType,
} from "@/generated/prisma/client";

export const COMMUNICATION_TYPES = [
  "COVER_LETTER",
  "APPLICATION_EMAIL",
  "RECRUITER_OUTREACH",
  "FOLLOW_UP",
  "INTERVIEW_THANK_YOU",
  "POST_INTERVIEW_FOLLOW_UP",
  "OFFER_RESPONSE",
  "GENERAL_PROFESSIONAL_MESSAGE",
] as const satisfies readonly CommunicationType[];

export const COMMUNICATION_STATUSES = [
  "DRAFT",
  "READY",
  "USED",
  "ARCHIVED",
] as const satisfies readonly CommunicationStatus[];

export const COMMUNICATION_TONES = [
  "PROFESSIONAL",
  "WARM",
  "CONCISE",
  "CONFIDENT",
  "FORMAL",
] as const satisfies readonly CommunicationTone[];

export const COMMUNICATION_LENGTHS = [
  "SHORT",
  "STANDARD",
  "DETAILED",
] as const satisfies readonly CommunicationLength[];

export const COMMUNICATION_LANGUAGES = [
  "ENGLISH",
  "ARABIC",
  "TURKISH",
] as const satisfies readonly CommunicationLanguage[];

export const COMMUNICATION_REVISION_SOURCES = [
  "AI_GENERATED",
  "USER_EDITED",
  "RULE_BASED_FALLBACK",
] as const satisfies readonly CommunicationRevisionSource[];

export const COMMUNICATION_GENERATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const satisfies readonly CommunicationGenerationStatus[];

export const COMMUNICATION_TRANSFORM_TYPES = [
  "SHORTER",
  "MORE_FORMAL",
  "WARMER",
  "MORE_CONFIDENT",
] as const;

export type CommunicationTransformType = (typeof COMMUNICATION_TRANSFORM_TYPES)[number];

export const OFFER_RESPONSE_INTENTS = [
  "ACKNOWLEDGE",
  "ASK_FOR_TIME",
  "ACCEPT",
  "DECLINE",
  "NEGOTIATE",
  "ASK_CLARIFICATION",
] as const;

export type OfferResponseIntent = (typeof OFFER_RESPONSE_INTENTS)[number];

export const RECIPIENT_MODES = [
  "PRIMARY_CONTACT",
  "SPECIFIC_CONTACT",
  "HIRING_TEAM",
  "UNKNOWN",
] as const;

export type RecipientMode = (typeof RECIPIENT_MODES)[number];

export const COMMUNICATION_EVIDENCE_SOURCES = [
  "resume",
  "job",
  "application",
  "contact",
  "timeline",
  "user_note",
] as const;

export type CommunicationEvidenceSource = (typeof COMMUNICATION_EVIDENCE_SOURCES)[number];

export type CommunicationEvidenceItem = {
  label: string;
  source: CommunicationEvidenceSource;
};

export type CommunicationWarning = {
  code: string;
  message: string;
};

export type CommunicationChangeLogItem = {
  action: string;
  detail: string;
};

export type CommunicationTrustCategory = "FACT" | "USER_INPUT" | "INTERPRETATION";

export type CommunicationUserIdentity = {
  name: string | null;
  email: string | null;
};

export type CommunicationJobFacts = {
  id: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  source: string | null;
};

export type CommunicationJobAnalysisFacts = {
  id: string | null;
  updatedAt: string | null;
  matchScore: number | null;
  roleAlignment: string | null;
  requirements: string[];
  matchedSkills: string[];
  gaps: string[];
};

export type CommunicationResumeFacts = {
  versionId: string | null;
  versionTitle: string | null;
  versionStatus: string | null;
  revisionId: string | null;
  revisionNumber: number | null;
  alignmentScore: number | null;
  summary: string | null;
  coreSkills: string[];
  experiencePoints: string[];
  projects: string[];
};

export type CommunicationContactFacts = {
  id: string | null;
  name: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
};

export type CommunicationTimelineFact = {
  type: string;
  title: string;
  eventAt: string;
};

export type CommunicationApplicationFacts = {
  id: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  followUpAt: string | null;
  notes: string | null;
  companyNotes: string | null;
  salaryNotes: string | null;
  documents: string[];
  confirmedRejectionReason: string | null;
  interviewCompleted: boolean;
  interviewCompletedAt: string | null;
  offerReceived: boolean;
  followUpSentCount: number;
};

export type CommunicationSettings = {
  type: CommunicationType;
  tone: CommunicationTone;
  length: CommunicationLength;
  language: CommunicationLanguage;
  offerIntent: OfferResponseIntent | null;
  recipientMode: RecipientMode;
  interviewOccurredConfirmed: boolean;
};

export type CommunicationContext = {
  user: CommunicationUserIdentity;
  application: CommunicationApplicationFacts | null;
  job: CommunicationJobFacts;
  jobAnalysis: CommunicationJobAnalysisFacts;
  resume: CommunicationResumeFacts;
  contact: CommunicationContactFacts;
  timeline: CommunicationTimelineFact[];
  settings: CommunicationSettings;
};

export type CommunicationContextSnapshot = {
  application: {
    id: string | null;
    status: ApplicationStatus | null;
    appliedAt: string | null;
    latestRelevantEvents: CommunicationTimelineFact[];
  };
  job: {
    id: string | null;
    title: string | null;
    company: string | null;
    location: string | null;
  };
  jobAnalysis: {
    id: string | null;
    matchScore: number | null;
    requirements: string[];
    matchedSkills: string[];
    gaps: string[];
  };
  resume: {
    versionId: string | null;
    revisionId: string | null;
    revisionNumber: number | null;
    alignmentScore: number | null;
  };
  contact: {
    id: string | null;
    name: string | null;
    role: string | null;
  };
  settings: {
    type: CommunicationType;
    tone: CommunicationTone;
    length: CommunicationLength;
    language: CommunicationLanguage;
    offerIntent: OfferResponseIntent | null;
    recipientMode: RecipientMode;
  };
};

export type CommunicationGenerationInput = {
  applicationId?: string | null;
  jobPostingId?: string | null;
  contactId?: string | null;
  resumeVersionId?: string | null;
  resumeVersionRevisionId?: string | null;
  recipientMode: RecipientMode;
  type: CommunicationType;
  tone?: CommunicationTone;
  length?: CommunicationLength;
  language?: CommunicationLanguage;
  offerIntent?: OfferResponseIntent | null;
  interviewOccurredConfirmed?: boolean;
};

export type CommunicationGenerationOutput = {
  subject: string | null;
  content: string;
  evidenceUsed: CommunicationEvidenceItem[];
  warnings: CommunicationWarning[];
  changeLog: CommunicationChangeLogItem[];
};

export type CommunicationRecommendation = {
  type: CommunicationType;
  label: string;
  reason: string;
  primary: boolean;
};

export type CommunicationDraftListItem = {
  id: string;
  type: CommunicationType;
  status: CommunicationStatus;
  language: CommunicationLanguage | null;
  recipientName: string | null;
  jobTitle: string | null;
  company: string | null;
  activeRevisionNumber: number | null;
  updatedAt: string;
};

export type CommunicationRevisionSummary = {
  id: string;
  revisionNumber: number;
  source: CommunicationRevisionSource;
  subject: string | null;
  content: string;
  tone: CommunicationTone;
  length: CommunicationLength;
  language: CommunicationLanguage;
  generationStatus: CommunicationGenerationStatus;
  model: string | null;
  aiSource: string | null;
  transform: CommunicationTransformType | null;
  createdAt: string;
  isActive: boolean;
};

export type CommunicationRevisionDetail = {
  id: string;
  revisionNumber: number;
  source: CommunicationRevisionSource;
  subject: string | null;
  content: string;
  tone: CommunicationTone;
  length: CommunicationLength;
  language: CommunicationLanguage;
  contextSnapshot: CommunicationContextSnapshot;
  contextFingerprint: string;
  evidenceUsed: CommunicationEvidenceItem[];
  warnings: CommunicationWarning[];
  changeLog: CommunicationChangeLogItem[];
  model: string | null;
  aiSource: string | null;
  generationStatus: CommunicationGenerationStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDraftDetail = {
  id: string;
  applicationId: string | null;
  jobPostingId: string | null;
  contactId: string | null;
  resumeVersionId: string | null;
  resumeVersionRevisionId: string | null;
  type: CommunicationType;
  status: CommunicationStatus;
  usedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  recipientName: string | null;
  recipientRole: string | null;
  applicationStatus: ApplicationStatus | null;
  resumeRevisionNumber: number | null;
  resumeVersionStatus: string | null;
  linkedToApplication: boolean;
  activeRevision: CommunicationRevisionDetail | null;
  revisions: CommunicationRevisionSummary[];
  contextStale: boolean;
  currentContextFingerprint: string | null;
};

export type CommunicationResumeOption = {
  versionId: string;
  versionTitle: string;
  versionStatus: string;
  revisionId: string;
  revisionNumber: number;
};

export type CommunicationContactOption = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  isPrimary: boolean;
};

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  COVER_LETTER: "Cover Letter",
  APPLICATION_EMAIL: "Application Email",
  RECRUITER_OUTREACH: "Recruiter Outreach",
  FOLLOW_UP: "Follow-up",
  INTERVIEW_THANK_YOU: "Interview Thank-you",
  POST_INTERVIEW_FOLLOW_UP: "Post-interview Follow-up",
  OFFER_RESPONSE: "Offer Response",
  GENERAL_PROFESSIONAL_MESSAGE: "General Professional Message",
};

export const COMMUNICATION_TONE_LABELS: Record<CommunicationTone, string> = {
  PROFESSIONAL: "Professional",
  WARM: "Warm",
  CONCISE: "Concise",
  CONFIDENT: "Confident",
  FORMAL: "Formal",
};

export const COMMUNICATION_LENGTH_LABELS: Record<CommunicationLength, string> = {
  SHORT: "Short",
  STANDARD: "Standard",
  DETAILED: "Detailed",
};

export const COMMUNICATION_LANGUAGE_LABELS: Record<CommunicationLanguage, string> = {
  ENGLISH: "English",
  ARABIC: "Arabic",
  TURKISH: "Turkish",
};

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  USED: "Used",
  ARCHIVED: "Archived",
};

export const OFFER_RESPONSE_INTENT_LABELS: Record<OfferResponseIntent, string> = {
  ACKNOWLEDGE: "Acknowledge receipt",
  ASK_FOR_TIME: "Ask for time",
  ACCEPT: "Accept",
  DECLINE: "Decline",
  NEGOTIATE: "Negotiate",
  ASK_CLARIFICATION: "Ask for clarification",
};

export const COMMUNICATION_TRANSFORM_LABELS: Record<CommunicationTransformType, string> = {
  SHORTER: "Shorter",
  MORE_FORMAL: "More Formal",
  WARMER: "Warmer",
  MORE_CONFIDENT: "More Confident",
};

export const EMPTY_JOB_FACTS: CommunicationJobFacts = {
  id: null,
  title: null,
  company: null,
  location: null,
  source: null,
};

export const EMPTY_JOB_ANALYSIS_FACTS: CommunicationJobAnalysisFacts = {
  id: null,
  updatedAt: null,
  matchScore: null,
  roleAlignment: null,
  requirements: [],
  matchedSkills: [],
  gaps: [],
};

export const EMPTY_RESUME_FACTS: CommunicationResumeFacts = {
  versionId: null,
  versionTitle: null,
  versionStatus: null,
  revisionId: null,
  revisionNumber: null,
  alignmentScore: null,
  summary: null,
  coreSkills: [],
  experiencePoints: [],
  projects: [],
};

export const EMPTY_CONTACT_FACTS: CommunicationContactFacts = {
  id: null,
  name: null,
  role: null,
  company: null,
  email: null,
};
