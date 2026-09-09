import type {
  ApplicationExecutionFailureCode,
  ApplicationExecutionMode,
  ApplicationExecutionStatus,
  ApplicationProvider,
  ApplicationSubmissionAttemptStatus,
  ApplicationSubmissionMethod,
  ApplicationSubmissionVerificationStatus,
} from "@/generated/prisma/client";

export const ADAPTER_VERSION = "1.0.0";

export const SUBMISSION_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const PRE_SUBMIT_MAX_RETRIES = 2;
export const SESSION_POLL_MS = 1500;

export type ApplicationFieldType =
  | "TEXT"
  | "EMAIL"
  | "PHONE"
  | "TEXTAREA"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX"
  | "FILE"
  | "DATE"
  | "NUMBER"
  | "COMBOBOX"
  | "OTHER";

export type ApplicationFieldClassification =
  | "IDENTITY"
  | "CONTACT"
  | "CAREER_FACT"
  | "DOCUMENT"
  | "PREFERENCE"
  | "LEGAL"
  | "SENSITIVE"
  | "FREE_TEXT"
  | "CONSENT"
  | "ASSESSMENT"
  | "REFERENCE"
  | "UNKNOWN";

export type ApplicationAnswerSource =
  | "PROFILE_FACT"
  | "RESUME_REVISION"
  | "APPLICATION_PACKAGE"
  | "SAVED_USER_ANSWER"
  | "USER_CONFIRMED"
  | "AI_GENERATED"
  | "ATS_DEFAULT";

export type ApplicationAnswerStatus =
  | "AUTO_FILL"
  | "PROPOSE"
  | "REVIEW_REQUIRED"
  | "NEEDS_INPUT"
  | "OPTIONAL_EMPTY"
  | "BLOCKED";

export type ApplicationFormOption = {
  value: string;
  label: string;
};

export type SelectorDescriptor = {
  strategy: "css" | "role" | "label" | "test-id";
  value: string;
  frameSelector?: string;
};

export type ApplicationFormField = {
  externalId: string;
  selector: SelectorDescriptor;
  label: string;
  normalizedLabel: string;
  type: ApplicationFieldType;
  required: boolean;
  options: ApplicationFormOption[];
  step: number;
  classification: ApplicationFieldClassification;
  confidence: number;
  currentValueState: "empty" | "filled" | "unknown";
  currentValuePreview: string | null;
  documentKind: "resume" | "cover_letter" | null;
};

export type SubmitControlDescriptor = {
  selector: SelectorDescriptor;
  label: string;
  isFinal: boolean;
  confidence: number;
};

export type ApplicationFormSnapshot = {
  provider: ApplicationProvider;
  pageUrl: string;
  step: number;
  totalSteps: number | null;
  fields: ApplicationFormField[];
  submitControl: SubmitControlDescriptor | null;
  nextControl: SubmitControlDescriptor | null;
  inspectedAt: string;
};

export type ResolvedApplicationAnswer = {
  fieldId: string;
  classification: ApplicationFieldClassification;
  value: string | boolean | null;
  source: ApplicationAnswerSource | null;
  confidence: number;
  status: ApplicationAnswerStatus;
  requiresConfirmation: boolean;
  confirmed: boolean;
  reviewed: boolean;
  originalGeneratedValue?: string | null;
  savePreference: boolean;
};

export type FillPlan = {
  answers: ResolvedApplicationAnswer[];
  uploadedDocuments: UploadedDocumentRecord[];
  lockedCoverLetterRevisionId?: string | null;
};

export type UploadedDocumentRecord = {
  fieldId: string;
  kind: "resume" | "cover_letter";
  revisionId: string;
  fileHash: string;
  fileName: string;
};

export type PendingActionKind =
  | "LEGAL"
  | "SENSITIVE"
  | "CONSENT"
  | "FREE_TEXT"
  | "LOGIN"
  | "MFA"
  | "CAPTCHA"
  | "ASSESSMENT"
  | "UNSUPPORTED_WIDGET"
  | "USER_INPUT"
  | "VALIDATION";

export type PendingAction = {
  kind: PendingActionKind;
  fieldId: string | null;
  message: string;
  failureCode: ApplicationExecutionFailureCode | null;
};

export type ExecutionWarning = {
  code: string;
  message: string;
};

export type AdapterCapabilities = {
  inspectForm: boolean;
  fillFields: boolean;
  uploadFiles: boolean;
  multiStep: boolean;
  detectLogin: boolean;
  detectCaptcha: boolean;
  detectAssessment: boolean;
  confirmedBrowserSubmit: boolean;
  verificationStrength: "none" | "generic" | "provider";
  officialApiSubmit: boolean;
};

export type DetectionResult = {
  provider: ApplicationProvider;
  confidence: number;
  reasons: string[];
  cautious: boolean;
  drifted: boolean;
};

export type InterruptionKind = "LOGIN" | "MFA" | "CAPTCHA" | "ASSESSMENT" | "CHALLENGE_FRAME" | null;

export type InterruptionDetection = {
  kind: InterruptionKind;
  message: string | null;
};

export type StepValidationResult = {
  ok: boolean;
  fieldId: string | null;
  message: string | null;
  recoverableFormat: boolean;
};

export type SubmissionVerificationResult = {
  status: ApplicationSubmissionVerificationStatus;
  method: "provider_marker" | "generic_thank_you" | "ambiguous" | "provider_error" | "user_confirmed";
  successMarkerCode: string | null;
  confirmationUrl: string | null;
  providerApplicationId: string | null;
  pageFingerprint: string | null;
  message: string;
};

export type FinalSubmissionField = {
  fieldId: string;
  normalizedLabel: string;
  classification: ApplicationFieldClassification;
  valueFingerprint: string;
  source: ApplicationAnswerSource | null;
  confirmed: boolean;
};

export type FinalSubmissionSnapshot = {
  applicationPackageId: string;
  packageVersion: number;
  applicationId: string;
  jobPostingId: string;
  provider: ApplicationProvider;
  adapterVersion: string;
  formFingerprint: string;
  fields: FinalSubmissionField[];
  resumeRevisionId: string;
  resumeFileHash: string;
  coverLetterRevisionId: string | null;
  coverLetterFileHash: string | null;
  consentConfirmations: string[];
};

export type ExecutionProgressCategory = {
  key: string;
  label: string;
  state: "complete" | "in_progress" | "needs_you" | "pending" | "not_present";
  countLabel: string | null;
};

export type ExecutionSessionView = {
  id: string;
  status: ApplicationExecutionStatus;
  provider: ApplicationProvider;
  executionMode: ApplicationExecutionMode;
  adapterVersion: string;
  detectionConfidence: number | null;
  jobTitle: string;
  company: string;
  currentUrl: string | null;
  currentDomain: string | null;
  currentStep: number | null;
  totalSteps: number | null;
  browserConnected: boolean;
  formFingerprint: string | null;
  progress: ExecutionProgressCategory[];
  pendingActions: PendingAction[];
  warnings: ExecutionWarning[];
  fields: Array<{
    id: string;
    label: string;
    classification: ApplicationFieldClassification;
    required: boolean;
    status: ApplicationAnswerStatus;
    confirmed: boolean;
    reviewed: boolean;
    proposedValue: string | null;
    originalGeneratedValue: string | null;
    previousAnswerAvailable: boolean;
  }>;
  review: FinalReviewView | null;
  submission: {
    attemptId: string | null;
    status: ApplicationSubmissionAttemptStatus | null;
    verificationStatus: ApplicationSubmissionVerificationStatus | null;
    method: ApplicationSubmissionMethod | null;
    confirmedBrowserSubmitAvailable: boolean;
    resumeRevisionId: string | null;
    resumeFileHash: string | null;
    coverLetterRevisionId: string | null;
    coverLetterFileHash: string | null;
    submittedAt: string | null;
    verifiedAt: string | null;
  };
  applicationStatus: string;
  packageStatus: string;
  failureCode: ApplicationExecutionFailureCode | null;
  failureMessage: string | null;
  events: Array<{ type: string; message: string; createdAt: string }>;
};

export type FinalReviewView = {
  requiredComplete: number;
  requiredTotal: number;
  resumeRevisionNumber: number | null;
  resumeRevisionId: string | null;
  resumeHashVerified: boolean;
  coverLetterRevisionNumber: number | null;
  coverLetterRevisionId: string | null;
  careerFactsVerified: number;
  legalConfirmed: number;
  aiReviewed: number;
  consentConfirmed: boolean;
  unresolved: string[];
  groups: {
    verified: string[];
    needsReview: string[];
    needsInput: string[];
    optional: string[];
  };
};

export type ConfirmOutcome = "SUBMITTED" | "NOT_SUBMITTED" | "NOT_SURE";
