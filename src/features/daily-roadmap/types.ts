import type {
  CareerActivityType,
  DailyRoadmapActionOrigin,
  DailyRoadmapActionStatus,
  DailyRoadmapActionType,
  DailyRoadmapCompletionSource,
  DailyRoadmapGenerationSource,
  DailyRoadmapPriorityBand,
  DailyRoadmapSourceEntityType,
  DailyRoadmapStatus,
} from "@/generated/prisma/client";

export const CAREER_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type CareerWeekday = (typeof CAREER_WEEKDAYS)[number];

export const DEFAULT_ACTIVE_WEEKDAYS: readonly CareerWeekday[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
];

export const ESTIMATED_MINUTE_BUCKETS = [5, 10, 15, 30, 45, 60, 90] as const;
export type EstimatedMinuteBucket = (typeof ESTIMATED_MINUTE_BUCKETS)[number];

export const DAILY_MINUTES_MIN = 15;
export const DAILY_MINUTES_MAX = 480;
export const MAX_CORE_ACTIONS_MIN = 1;
export const MAX_CORE_ACTIONS_MAX = 7;
export const DEFAULT_DAILY_MINUTES_TARGET = 60;
export const DEFAULT_MAX_CORE_ACTIONS = 4;
export const DEFAULT_TIMEZONE = "UTC";
export const MAX_RAW_CANDIDATES = 50;
export const MAX_OPTIONAL_LATER = 3;
export const TOP_PRIORITY_COUNT = 3;

export const SKIP_REASONS = [
  "NOT_RELEVANT",
  "NO_TIME",
  "ALREADY_DONE",
  "BLOCKED",
  "OTHER",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const DEFER_PRESETS = ["TOMORROW", "LATER_THIS_WEEK", "PICK_DATE"] as const;
export type DeferPreset = (typeof DEFER_PRESETS)[number];

export type PriorityComponents = {
  urgency: number;
  careerImpact: number;
  readiness: number;
  opportunityQuality: number;
  momentumNeglect: number;
  effortEfficiency: number;
};

export type PriorityEvidence = {
  components: PriorityComponents;
  total: number;
  band: DailyRoadmapPriorityBand;
  hardOverride: boolean;
  hardOverrideReason: string | null;
  facts: string[];
};

export type DailyActionCandidate = {
  type: DailyRoadmapActionType;
  origin: DailyRoadmapActionOrigin;
  sourceEntityType: DailyRoadmapSourceEntityType;
  sourceEntityId: string | null;
  title: string;
  summary: string | null;
  whyNowFacts: string[];
  estimatedMinutes: EstimatedMinuteBucket;
  isMeaningful: boolean;
  isActionable: boolean;
  blockedReason: string | null;
  urgencySignals: string[];
  impactSignals: string[];
  readinessSignals: string[];
  opportunityQualitySignals: string[];
  neglectSignals: string[];
  efficiencySignals: string[];
  deepLink: string | null;
  fingerprint: string;
  contextSnapshot: Record<string, unknown>;
  category: DailyActionCategory;
};

export type DailyActionCategory =
  | "jobs"
  | "applications"
  | "follow_up"
  | "linkedin"
  | "skills"
  | "profile"
  | "setup";

export type ScoredDailyActionCandidate = DailyActionCandidate & {
  priority: PriorityEvidence;
};

export type DailyRoadmapPreferenceView = {
  timezone: string;
  dailyMinutesTarget: number;
  maxCoreActions: number;
  activeWeekdays: CareerWeekday[];
  includeLinkedIn: boolean;
  includeSkillDevelopment: boolean;
  timezoneSource: "user" | "default";
};

export type DailyRoadmapActionView = {
  id: string;
  type: DailyRoadmapActionType;
  origin: DailyRoadmapActionOrigin;
  sourceEntityType: DailyRoadmapSourceEntityType;
  sourceEntityId: string | null;
  title: string;
  summary: string | null;
  whyNow: string | null;
  priorityBand: DailyRoadmapPriorityBand;
  estimatedMinutes: number;
  status: DailyRoadmapActionStatus;
  isMeaningful: boolean;
  isActionable: boolean;
  blockedReason: string | null;
  sortOrder: number;
  deferredUntil: string | null;
  completedAt: string | null;
  completionSource: DailyRoadmapCompletionSource | null;
  deepLink: string | null;
  primaryActionLabel: string;
  fingerprint: string;
};

export type DailyRoadmapView = {
  id: string;
  localDate: string;
  timezone: string;
  status: DailyRoadmapStatus;
  generatedAt: string;
  refreshedAt: string | null;
  plannedMinutes: number;
  generationSource: DailyRoadmapGenerationSource;
  actions: DailyRoadmapActionView[];
  topPriorities: DailyRoadmapActionView[];
  remainingCore: DailyRoadmapActionView[];
  completed: DailyRoadmapActionView[];
  deferred: DailyRoadmapActionView[];
  optionalLater: DailyRoadmapActionView[];
  blocked: DailyRoadmapActionView[];
};

export type CareerStreakView = {
  currentStreak: number;
  longestStreak: number;
  activeDaysThisWeek: number;
  scheduledDaysThisWeek: number;
  todayQualifies: boolean;
  todayIsScheduledCareerDay: boolean;
  localDate: string;
  timezone: string;
};

export type TodayWorkspaceView = {
  localDate: string;
  timezone: string;
  preferences: DailyRoadmapPreferenceView;
  roadmap: DailyRoadmapView | null;
  streak: CareerStreakView;
  progress: {
    completedActions: number;
    plannedActions: number;
    completedEstimatedMinutes: number;
    plannedEstimatedMinutes: number;
    meaningfulActions: number;
  };
  emptyState: "first_use" | "no_roadmap" | "no_urgent" | "active" | null;
  firstUseSuggestions: Array<{
    title: string;
    whyNow: string;
    deepLink: string;
    label: string;
  }>;
};

export type RecordMeaningfulActivityInput = {
  userId: string;
  activityType: CareerActivityType;
  fingerprint: string;
  sourceEntityType: DailyRoadmapSourceEntityType;
  sourceEntityId?: string | null;
  minutes?: number | null;
  occurredAt?: Date;
  timezone?: string;
};

export type { CareerActivityType };
export type {
  DailyRoadmapActionOrigin,
  DailyRoadmapActionStatus,
  DailyRoadmapActionType,
  DailyRoadmapCompletionSource,
  DailyRoadmapGenerationSource,
  DailyRoadmapPriorityBand,
  DailyRoadmapSourceEntityType,
  DailyRoadmapStatus,
};
