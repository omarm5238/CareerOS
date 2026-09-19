import type {
  CareerGraphEntityType,
  CareerGraphRelationType,
  CareerGraphStatus,
  CareerMemoryCategory,
  CareerMemoryConfidence,
  CareerMemoryContradictionClass,
  CareerMemoryEvidenceType,
  CareerMemoryImportance,
  CareerMemorySourceType,
  CareerMemoryStatus,
  CareerMemoryType,
} from "@/generated/prisma/client";

export type {
  CareerGraphEntityType,
  CareerGraphRelationType,
  CareerGraphStatus,
  CareerMemoryCategory,
  CareerMemoryConfidence,
  CareerMemoryContradictionClass,
  CareerMemoryEvidenceType,
  CareerMemoryImportance,
  CareerMemorySourceType,
  CareerMemoryStatus,
  CareerMemoryType,
};

export const MEMORY_BOOTSTRAP_WEEKS = 12;
export const MEMORY_TODAY_CAP = 12;
export const MEMORY_REVIEW_CAP = 20;
export const MEMORY_DEFAULT_CAP = 16;
export const MEMORY_CONTEXTUAL_BONUS_CAP = 5;

export const SOURCE_WEIGHTS = {
  USER_CORRECTED: 100,
  USER_DECLARED: 95,
  DIRECT_DOMAIN_EVENT: 90,
  REPEATED_WEEKLY_PATTERN: 75,
  REPEATED_DAILY_PATTERN: 65,
  SINGLE_DERIVED_SIGNAL: 40,
} as const;

export type MemoryContextType =
  | "TODAY_PLANNING"
  | "WEEKLY_REVIEW"
  | "JOB_ANALYSIS"
  | "APPLICATION_PREP"
  | "RESUME_TAILORING"
  | "LINKEDIN_CONTENT"
  | "SKILL_PLANNING"
  | "GENERAL_CAREER";

export type MemoryIngestionMode = "EVENT_DRIVEN" | "REVIEW_DRIVEN" | "ON_DEMAND" | "REBUILD";

export type MemoryEvidenceDraft = {
  sourceSubsystem: CareerMemorySourceType;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceEventId: string | null;
  observedAt: Date;
  evidenceType: CareerMemoryEvidenceType;
  evidence: Record<string, unknown>;
  weight: number;
  fingerprint: string;
};

export type MemoryGraphSuggestion = {
  entityType: CareerGraphEntityType;
  canonicalKey: string;
  displayName: string;
  relationType: CareerGraphRelationType;
};

export type MemoryCandidate = {
  type: CareerMemoryType;
  category: CareerMemoryCategory;
  subjectKey: string;
  normalizedValueKey: string;
  value: Record<string, unknown>;
  normalizedText: string;
  sourceType: CareerMemorySourceType;
  evidence: MemoryEvidenceDraft[];
  importance: CareerMemoryImportance;
  validityClass: "PERSISTENT" | "SKILL" | "EVIDENCE" | "PATTERN" | "BEHAVIOR" | "FOCUS" | "MILESTONE";
  sensitivityClass: "SAFE" | "SENSITIVE";
  graphSuggestions: MemoryGraphSuggestion[];
};

export type CareerMemoryPreferenceView = {
  memoryEnabled: boolean;
  allowBehavioralMemory: boolean;
  allowDerivedPatterns: boolean;
  allowLongTermPreferences: boolean;
  memoryResetAt: string | null;
  lastRefreshedAt: string | null;
};

export type CareerMemoryView = {
  id: string;
  type: CareerMemoryType;
  category: CareerMemoryCategory;
  subjectKey: string;
  normalizedValueKey: string | null;
  value: Record<string, unknown>;
  normalizedText: string;
  semanticKey: string;
  status: CareerMemoryStatus;
  confidence: CareerMemoryConfidence;
  confidenceLabel: string;
  importance: CareerMemoryImportance;
  sourceType: CareerMemorySourceType;
  sourceLabel: string;
  firstObservedAt: string;
  lastObservedAt: string;
  lastConfirmedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isUserDeclared: boolean;
  isUserCorrected: boolean;
  whyRemembered: string[];
  evidenceCount: number;
};

export type CareerGraphNodeView = {
  id: string;
  entityType: CareerGraphEntityType;
  canonicalKey: string;
  displayName: string;
};

export type CareerGraphRelationView = {
  id: string;
  relationType: CareerGraphRelationType;
  fromKey: string;
  toKey: string;
  fromName: string;
  toName: string;
  confidence: CareerMemoryConfidence;
  confidenceLabel: string;
  why: string;
  status: CareerGraphStatus;
};

export type CareerGraphView = {
  nodes: CareerGraphNodeView[];
  relations: CareerGraphRelationView[];
};

export type StructuredMemoryContext = {
  focus: CareerMemoryView[];
  skills: CareerMemoryView[];
  evidenceGaps: CareerMemoryView[];
  preferences: CareerMemoryView[];
  patterns: CareerMemoryView[];
  constraints: CareerMemoryView[];
  milestones: CareerMemoryView[];
};

export type MemoryWorkspaceView = {
  preferences: CareerMemoryPreferenceView;
  memories: CareerMemoryView[];
  needsReview: CareerMemoryView[];
  graph: CareerGraphView;
  empty: boolean;
};
