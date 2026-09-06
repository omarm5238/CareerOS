import type {
  ApplicationEffort,
  ApplicationPackageQaStatus,
  ApplicationPackageStatus,
  ApplicationReadinessStatus,
  OpportunityPriorityBand,
} from "@/generated/prisma/client";

import type {
  EligibilityCheck,
  JobGap,
  JobOpportunityView,
  JobRequirementView,
  OpportunityWarning,
} from "@/features/jobs/opportunities/types";

export type ApplicationExecutionMode = "MANUAL_EXTERNAL" | "ASSISTED_FORM" | "OFFICIAL_API";

export type SubmissionOutcome = "SUBMITTED" | "NOT_YET" | "CLOSED" | "DECLINED_TO_APPLY";

export type RequiredUserInputKey =
  | "WORK_AUTHORIZATION"
  | "VISA_SPONSORSHIP"
  | "SALARY_EXPECTATION"
  | "RELOCATION"
  | "START_DATE"
  | "SECURITY_CLEARANCE"
  | "OTHER";

export type RequiredUserInputCategory =
  | "SAFE_FACT"
  | "PREFERENCE"
  | "LEGAL"
  | "SENSITIVE"
  | "FREE_TEXT"
  | "UNKNOWN";

export type RequiredUserInput = {
  key: RequiredUserInputKey;
  label: string;
  category: RequiredUserInputCategory;
  reason: string;
  value: string | null;
  valueSource: "user" | "none";
  requiresConfirmation: boolean;
  resolved: boolean;
  resolvedAt: string | null;
};

export type QaCheck = {
  key: string;
  passed: boolean;
  message: string;
};

export type ApplicationPackageQaResult = {
  status: ApplicationPackageQaStatus;
  checks: QaCheck[];
  repairAttempted: number;
};

export type ApplicationPackageView = {
  id: string;
  version: number;
  jobPostingId: string | null;
  applicationId: string | null;
  jobTitle: string;
  company: string;
  location: string | null;
  workMode: string | null;
  applyUrl: string | null;
  status: ApplicationPackageStatus;
  readinessStatus: ApplicationReadinessStatus;
  qaStatus: ApplicationPackageQaStatus;
  userFacingState: "READY_TO_APPLY" | "NEEDS_YOUR_INPUT" | "BLOCKED" | "APPROVED" | "SUBMISSION_STARTED" | "SUBMITTED" | "ARCHIVED";
  opportunityScore: number | null;
  priorityBand: OpportunityPriorityBand | null;
  evidenceCoverage: number | null;
  applicationEffort: ApplicationEffort | null;
  eligibilityStatus: string | null;
  resumeVersionId: string | null;
  resumeVersionRevisionId: string | null;
  resumeTitle: string | null;
  resumeRevisionNumber: number | null;
  resumeStatus: string | null;
  coverLetterDraftId: string | null;
  coverLetterRequired: boolean;
  coverLetterStatus: string | null;
  applicationEmailDraftId: string | null;
  whyYouMatch: string[];
  requirements: JobRequirementView[];
  gaps: JobGap[];
  eligibilityChecks: EligibilityCheck[];
  requiredUserInputs: RequiredUserInput[];
  qa: ApplicationPackageQaResult;
  warnings: OpportunityWarning[];
  stale: boolean;
  contextFingerprint: string;
  preparedAt: string | null;
  approvedAt: string | null;
  submissionStartedAt: string | null;
  submittedAt: string | null;
};

export type ApplyNowCounts = {
  readyToReview: number;
  needsInput: number;
  highPriority: number;
  preparedToday: number;
};

export type ApplyNowCard = {
  packageId: string | null;
  jobPostingId: string | null;
  queueItemId: string | null;
  title: string;
  company: string;
  priorityBand: OpportunityPriorityBand | null;
  opportunityScore: number | null;
  evidenceCoverage: number | null;
  mainGap: string | null;
  freshnessLabel: string | null;
  applicationEffort: ApplicationEffort | null;
  readinessStatus: ApplicationReadinessStatus | null;
  packageStatus: ApplicationPackageStatus | null;
  alreadyApplied: boolean;
};

export type ApplyNowData = {
  counts: ApplyNowCounts;
  preparationMode: "MANUAL" | "ASSISTED" | "AUTO_PREPARE";
  cards: ApplyNowCard[];
};

export type BatchPrepareResult = {
  jobPostingId: string | null;
  queueItemId: string | null;
  packageId: string | null;
  status: "prepared" | "reused" | "failed";
  error: string | null;
};

export type OpportunitySnapshot = Pick<
  JobOpportunityView,
  | "opportunityScore"
  | "priorityScore"
  | "priorityBand"
  | "recommendation"
  | "eligibilityStatus"
  | "applicationEffort"
  | "evidenceCoverage"
  | "summary"
  | "whyYouMatch"
  | "contextFingerprint"
>;
