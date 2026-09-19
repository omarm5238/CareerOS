import type {
  WeeklyCareerGenerationSource,
  WeeklyCareerInsightConfidence,
  WeeklyCareerInsightSeverity,
  WeeklyCareerInsightType,
  WeeklyCareerMetricApplicability,
  WeeklyCareerMetricCategory,
  WeeklyCareerMetricSourceSubsystem,
  WeeklyCareerMomentumBand,
  WeeklyCareerRecommendationPriority,
  WeeklyCareerRecommendationStatus,
  WeeklyCareerReviewStatus,
} from "@/generated/prisma/client";

export const MOMENTUM_WEIGHTS = {
  execution: 25,
  applications: 25,
  opportunities: 20,
  visibility: 15,
  skills: 15,
} as const;

export const MOMENTUM_BANDS = {
  STRONG: { min: 80, max: 100 },
  STEADY: { min: 65, max: 79 },
  MIXED: { min: 45, max: 64 },
  LOW: { min: 0, max: 44 },
} as const;

export const WEEKLY_HISTORY_BOUND = 12;
export const MAX_WINS = 5;
export const MAX_FRICTION = 5;
export const DEFAULT_RECOMMENDATIONS = 3;
export const MAX_RECOMMENDATIONS = 5;
export const MAX_HANDOFF_CANDIDATES = 3;

export type SignalApplicability = WeeklyCareerMetricApplicability | "UNAVAILABLE";

export type WeeklySubSignal = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  applicability: SignalApplicability;
  evidence: string;
};

export type WeeklyComponentResult = {
  key: "execution" | "applications" | "opportunities" | "visibility" | "skills";
  label: string;
  score: number | null;
  maxScore: number;
  applicability: "DATA_AVAILABLE" | "NO_ACTIVITY" | "NOT_APPLICABLE";
  evidenceSummary: string;
  subSignals: WeeklySubSignal[];
  previousScore?: number | null;
  delta?: number | null;
};

export type WeeklyMomentumResult = {
  overallScore: number | null;
  band: WeeklyCareerMomentumBand | null;
  components: WeeklyComponentResult[];
  previousOverallScore: number | null;
  overallDelta: number | null;
  firstReview: boolean;
};

export type WeeklyFactCount = {
  value: number;
  ids: string[];
};

export type WeeklyCareerFacts = {
  period: {
    weekStartLocalDate: string;
    weekEndLocalDate: string;
    timezone: string;
    isComplete: boolean;
    isCurrent: boolean;
  };
  preferences: {
    includeLinkedIn: boolean;
    includeSkillDevelopment: boolean;
    activeWeekdays: string[];
    hasLinkedinProfile: boolean;
  };
  execution: {
    scheduledDays: number;
    activeDays: number;
    meaningfulActions: number;
    corePlanned: number;
    coreCompleted: number;
    deferred: number;
    skipped: number;
    carryOver: number;
    repeatedCarryOverIntents: number;
    plannedMinutes: number;
    completedEstimatedMinutes: number;
    repeatedIntentIds: string[];
  };
  applications: {
    created: WeeklyFactCount;
    submitted: WeeklyFactCount;
    stageProgressions: Array<{ id: string; fromStatus: string; toStatus: string }>;
    followUpsDue: WeeklyFactCount;
    followUpsCompleted: WeeklyFactCount;
    interviewAssessmentRequired: WeeklyFactCount;
    interviewAssessmentPrep: WeeklyFactCount;
    actionableReadyCount: number;
    activeSubmittedCohort: number;
    followUpDueReliable: boolean;
  };
  opportunities: {
    strongDiscovered: WeeklyFactCount;
    strongReviewed: WeeklyFactCount;
    strongPrepared: WeeklyFactCount;
    readyToApply: WeeklyFactCount;
    handedOff: WeeklyFactCount;
    expiredUnacted: WeeklyFactCount;
    strongActionable: number;
  };
  resume: {
    versionsCreated: WeeklyFactCount;
    revisionsCreated: WeeklyFactCount;
    ready: WeeklyFactCount;
    used: WeeklyFactCount;
  };
  communication: {
    created: WeeklyFactCount;
    used: WeeklyFactCount;
    followUpUsed: WeeklyFactCount;
    interviewThankYouUsed: WeeklyFactCount;
    recruiterOutreachUsed: WeeklyFactCount;
  };
  linkedin: {
    ready: WeeklyFactCount;
    published: WeeklyFactCount;
    readyUnpublished: WeeklyFactCount;
    performanceSnapshots: WeeklyFactCount;
    visibilityGapActions: WeeklyFactCount;
    profileImprovementActions: WeeklyFactCount;
  };
  skillsEvidence: {
    skillActionsCompleted: WeeklyFactCount;
    evidenceActionsCompleted: WeeklyFactCount;
    skillActionsPlanned: number;
    recurringGapsAddressed: WeeklyFactCount;
    remainingGaps: string[];
  };
  limitations: string[];
};

export type WeeklyMetricDraft = {
  category: WeeklyCareerMetricCategory;
  metricKey: string;
  numericValue?: number | null;
  textValue?: string | null;
  denominatorValue?: number | null;
  applicability: WeeklyCareerMetricApplicability;
  sourceSubsystem: WeeklyCareerMetricSourceSubsystem;
  evidence: Record<string, unknown>;
};

export type WeeklyInsightDraft = {
  type: WeeklyCareerInsightType;
  category: WeeklyCareerMetricCategory;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  confidence: WeeklyCareerInsightConfidence;
  severity: WeeklyCareerInsightSeverity;
  fingerprint: string;
};

export type WeeklyRecommendationDraft = {
  category: WeeklyCareerMetricCategory;
  title: string;
  reason: string;
  priority: WeeklyCareerRecommendationPriority;
  sourceEvidence: Record<string, unknown>;
  recommendedActionType: string | null;
  deepLink: string | null;
  fingerprint: string;
};

export type WeeklyReviewView = {
  id: string;
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  weekLabel: string;
  timezone: string;
  status: WeeklyCareerReviewStatus;
  generatedAt: string;
  refreshedAt: string | null;
  finalizedAt: string | null;
  generationSource: WeeklyCareerGenerationSource;
  overallMomentumScore: number | null;
  overallMomentumBand: WeeklyCareerMomentumBand | null;
  summary: string | null;
  winsSummary: string | null;
  frictionSummary: string | null;
  wins: string[];
  friction: string[];
  limitations: string[];
  components: WeeklyComponentResult[];
  previousOverallScore: number | null;
  overallDelta: number | null;
  firstReview: boolean;
  isCurrent: boolean;
  isComplete: boolean;
  metrics: Array<{
    id: string;
    category: WeeklyCareerMetricCategory;
    metricKey: string;
    numericValue: number | null;
    textValue: string | null;
    denominatorValue: number | null;
    applicability: WeeklyCareerMetricApplicability;
    sourceSubsystem: WeeklyCareerMetricSourceSubsystem;
    evidence: Record<string, unknown>;
  }>;
  insights: Array<{
    id: string;
    type: WeeklyCareerInsightType;
    category: WeeklyCareerMetricCategory;
    title: string;
    summary: string;
    confidence: WeeklyCareerInsightConfidence;
    confidenceLabel: string;
    severity: WeeklyCareerInsightSeverity;
    evidence: Record<string, unknown>;
  }>;
  recommendations: Array<{
    id: string;
    category: WeeklyCareerMetricCategory;
    title: string;
    reason: string;
    priority: WeeklyCareerRecommendationPriority;
    recommendedActionType: string | null;
    deepLink: string | null;
    status: WeeklyCareerRecommendationStatus;
    adoptedAt: string | null;
    fingerprint: string;
  }>;
};

export type WeeklyHistoryItem = {
  id: string;
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  weekLabel: string;
  status: WeeklyCareerReviewStatus;
  overallMomentumScore: number | null;
  overallMomentumBand: WeeklyCareerMomentumBand | null;
  activeDays: number | null;
};

export type WeeklyWorkspaceView = {
  current: WeeklyReviewView | null;
  period: {
    weekStartLocalDate: string;
    weekEndLocalDate: string;
    weekLabel: string;
    timezone: string;
    isComplete: boolean;
    isCurrent: boolean;
  };
  history: WeeklyHistoryItem[];
  latestCompletedMissing: boolean;
  latestCompletedWeekStart: string | null;
};
