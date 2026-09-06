import type {
  ApplicationEffort,
  JobEligibilityStatus,
  JobEvidenceMatchStrength,
  JobEvidenceType,
  JobOpportunityAnalysisSource,
  JobOpportunityAnalysisStatus,
  JobRequirementCategory,
  JobRequirementImportance,
  OpportunityPriorityBand,
  OpportunityRecommendation,
} from "@/generated/prisma/client";

export type GapSeverity = "CRITICAL" | "IMPORTANT" | "MINOR" | "OPTIONAL";

export type GapRecommendedAction =
  | "BLOCK_APPLICATION"
  | "USER_REVIEW"
  | "APPLY_ANYWAY"
  | "EMPHASIZE_TRANSFERABLE_EVIDENCE"
  | "ADDRESS_IN_RESUME"
  | "LEARN_LATER"
  | "IGNORE";

export type EligibilityCheckKey =
  | "LOCATION"
  | "WORK_MODE"
  | "SENIORITY"
  | "LANGUAGE"
  | "WORK_AUTHORIZATION"
  | "VISA_SPONSORSHIP"
  | "SECURITY_CLEARANCE"
  | "REQUIRED_CERTIFICATION"
  | "EMPLOYMENT_RESTRICTION";

export type JobRequirementInput = {
  category: JobRequirementCategory;
  importance: JobRequirementImportance;
  normalizedName: string;
  rawText: string;
  sourceExcerpt: string;
  yearsRequired: number | null;
  proficiencyRequired: string | null;
  isExplicit: boolean;
};

export type JobEvidenceCandidate = {
  evidenceType: JobEvidenceType;
  evidenceSourceId: string | null;
  evidenceLabel: string;
  evidenceExcerpt: string | null;
  tokens: string[];
};

export type JobEvidenceView = {
  id?: string;
  evidenceType: JobEvidenceType;
  evidenceSourceId: string | null;
  evidenceLabel: string;
  evidenceExcerpt: string | null;
  matchStrength: JobEvidenceMatchStrength;
  reasoning: string | null;
};

export type JobRequirementView = {
  id: string;
  category: JobRequirementCategory;
  importance: JobRequirementImportance;
  normalizedName: string;
  rawText: string;
  sourceExcerpt: string;
  yearsRequired: number | null;
  isExplicit: boolean;
  bestMatch: JobEvidenceView | null;
  evidence: JobEvidenceView[];
};

export type JobGap = {
  requirementName: string;
  category: JobRequirementCategory;
  importance: JobRequirementImportance;
  matchStrength: JobEvidenceMatchStrength;
  severity: GapSeverity;
  recommendedAction: GapRecommendedAction;
  explanation: string;
};

export type EligibilityCheck = {
  key: EligibilityCheckKey;
  status: JobEligibilityStatus;
  reason: string;
  evidence: string | null;
  requiresUserConfirmation: boolean;
};

export type OpportunityScoreComponents = {
  roleFit: number;
  skillFit: number;
  evidenceFit: number;
  experienceFit: number;
  locationFit: number;
  authorizationFit: number;
  freshnessScore: number;
  applicationEffortScore: number;
};

export type OpportunityWarning = {
  code: string;
  message: string;
};

export type JobOpportunityView = {
  id: string;
  jobPostingId: string;
  status: JobOpportunityAnalysisStatus;
  analysisSource: JobOpportunityAnalysisSource;
  components: OpportunityScoreComponents;
  opportunityScore: number;
  priorityScore: number;
  priorityBand: OpportunityPriorityBand;
  recommendation: OpportunityRecommendation;
  eligibilityStatus: JobEligibilityStatus;
  applicationEffort: ApplicationEffort;
  evidenceCoverage: number;
  criticalGapCount: number;
  importantGapCount: number;
  minorGapCount: number;
  optionalGapCount: number;
  gaps: JobGap[];
  eligibilityChecks: EligibilityCheck[];
  warnings: OpportunityWarning[];
  summary: string | null;
  whyYouMatch: string[];
  contextFingerprint: string;
  updatedAt: string;
};

export type CareerEvidenceItem = JobEvidenceCandidate;

export const IMPORTANCE_WEIGHTS: Record<JobRequirementImportance, number> = {
  REQUIRED: 4,
  STRONGLY_PREFERRED: 3,
  PREFERRED: 2,
  OPTIONAL: 1,
  UNKNOWN: 1,
};

export const EVIDENCE_MULTIPLIERS: Record<JobEvidenceMatchStrength, number> = {
  DIRECT: 1,
  STRONG: 0.9,
  PARTIAL: 0.6,
  TRANSFERABLE: 0.4,
  NONE: 0,
};

export const EFFORT_SCORES: Record<ApplicationEffort, number> = {
  LOW: 100,
  MEDIUM: 60,
  HIGH: 25,
  UNKNOWN: 50,
};

export const PRIORITY_BAND_LABELS: Record<OpportunityPriorityBand, string> = {
  APPLY_NOW: "Apply now",
  HIGH_PRIORITY: "High priority",
  GOOD_OPPORTUNITY: "Good opportunity",
  REVIEW_FIRST: "Review first",
  LOW_PRIORITY: "Low priority",
  SKIP: "Skip",
};

export const MATCH_STRENGTH_LABELS: Record<JobEvidenceMatchStrength, string> = {
  DIRECT: "Direct",
  STRONG: "Strong",
  PARTIAL: "Partial",
  TRANSFERABLE: "Transferable",
  NONE: "None",
};
