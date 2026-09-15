import type {
  LinkedinContentFormat,
  LinkedinContentIdeaStatus,
  LinkedinContentLanguage,
  LinkedinContentPillarPriority,
  LinkedinContentTone,
  LinkedinEvidenceStrength,
  LinkedinGrowthGoal,
  LinkedinGrowthInsightStatus,
  LinkedinGrowthInsightType,
  LinkedinGrowthStrategyStatus,
  LinkedinPerformanceSource,
  LinkedinPostGenerationStatus,
  LinkedinPostObjective,
  LinkedinPostQaStatus,
  LinkedinPostRevisionSource,
  LinkedinPostStatus,
  LinkedinPublishMode,
  LinkedinPublishingPlanStatus,
  LinkedinPublishingSource,
  LinkedinRecruiterRelevance,
  LinkedinTimeliness,
} from "@/generated/prisma/client";

export type {
  LinkedinContentFormat,
  LinkedinContentIdeaStatus,
  LinkedinContentLanguage,
  LinkedinContentPillarPriority,
  LinkedinContentTone,
  LinkedinEvidenceStrength,
  LinkedinGrowthGoal,
  LinkedinGrowthInsightStatus,
  LinkedinGrowthInsightType,
  LinkedinGrowthStrategyStatus,
  LinkedinPerformanceSource,
  LinkedinPostGenerationStatus,
  LinkedinPostObjective,
  LinkedinPostQaStatus,
  LinkedinPostRevisionSource,
  LinkedinPostStatus,
  LinkedinPublishMode,
  LinkedinPublishingPlanStatus,
  LinkedinPublishingSource,
  LinkedinRecruiterRelevance,
  LinkedinTimeliness,
};

export const LINKEDIN_GROWTH_GOALS = [
  "GET_HIRED",
  "ATTRACT_RECRUITERS",
  "BUILD_AUTHORITY",
  "SHOWCASE_PROJECTS",
  "GROW_NETWORK",
  "CAREER_TRANSITION",
  "PERSONAL_BRAND",
  "LEARN_IN_PUBLIC",
] as const satisfies readonly LinkedinGrowthGoal[];

export const LINKEDIN_STRATEGY_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "NEEDS_REFRESH",
  "ARCHIVED",
] as const satisfies readonly LinkedinGrowthStrategyStatus[];

export const LINKEDIN_PILLAR_PRIORITIES = [
  "CORE",
  "SECONDARY",
  "EXPERIMENTAL",
] as const satisfies readonly LinkedinContentPillarPriority[];

export const LINKEDIN_IDEA_STATUSES = [
  "NEW",
  "SHORTLISTED",
  "DRAFTED",
  "DISMISSED",
  "ARCHIVED",
] as const satisfies readonly LinkedinContentIdeaStatus[];

export const LINKEDIN_CONTENT_FORMATS = [
  "TEXT_POST",
  "STORY_POST",
  "TECHNICAL_BREAKDOWN",
  "PROJECT_SHOWCASE",
  "LESSON_LEARNED",
  "CAREER_REFLECTION",
  "OPINION",
  "CHECKLIST",
  "HOW_TO",
  "CASE_STUDY",
  "MILESTONE",
  "QUESTION",
  "RESOURCE_SHARE",
] as const satisfies readonly LinkedinContentFormat[];

export const LINKEDIN_POST_OBJECTIVES = [
  "SHOW_EXPERTISE",
  "SHOW_PROJECT_EVIDENCE",
  "SHOW_LEARNING",
  "BUILD_TRUST",
  "START_DISCUSSION",
  "CAREER_POSITIONING",
  "NETWORKING",
  "MILESTONE",
] as const satisfies readonly LinkedinPostObjective[];

export const LINKEDIN_POST_STATUSES = [
  "DRAFT",
  "REVIEW",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const satisfies readonly LinkedinPostStatus[];

export const LINKEDIN_REVISION_SOURCES = [
  "AI_GENERATED",
  "USER_EDITED",
  "REGENERATED",
  "SHORTENED",
  "EXPANDED",
  "TONE_CHANGED",
  "HOOK_REWRITTEN",
  "CTA_REWRITTEN",
  "REPURPOSED",
  "TRANSLATED",
  "RULE_BASED_FALLBACK",
] as const satisfies readonly LinkedinPostRevisionSource[];

export const LINKEDIN_PLAN_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "CANCELLED",
  "STALE",
] as const satisfies readonly LinkedinPublishingPlanStatus[];

export const LINKEDIN_PUBLISH_MODES = [
  "MANUAL",
  "LINKEDIN_OFFICIAL",
] as const satisfies readonly LinkedinPublishMode[];

export const LINKEDIN_PUBLISHING_SOURCES = [
  "USER_CONFIRMED",
  "LINKEDIN_OFFICIAL",
] as const satisfies readonly LinkedinPublishingSource[];

export const LINKEDIN_PERFORMANCE_SOURCES = [
  "USER_ENTERED",
  "LINKEDIN_OFFICIAL",
] as const satisfies readonly LinkedinPerformanceSource[];

export const LINKEDIN_INSIGHT_TYPES = [
  "PILLAR_PERFORMANCE",
  "FORMAT_PERFORMANCE",
  "AUDIENCE_RESPONSE",
  "POSTING_FREQUENCY",
  "HOOK_PATTERN",
  "CONTENT_GAP",
  "RECRUITER_SIGNAL",
  "PROFILE_RECOMMENDATION",
  "NEXT_POST_RECOMMENDATION",
] as const satisfies readonly LinkedinGrowthInsightType[];

export const LINKEDIN_INSIGHT_STATUSES = [
  "ACTIVE",
  "DISMISSED",
] as const satisfies readonly LinkedinGrowthInsightStatus[];

export const LINKEDIN_EVIDENCE_STRENGTHS = [
  "STRONG",
  "MODERATE",
  "WEAK",
] as const satisfies readonly LinkedinEvidenceStrength[];

export const LINKEDIN_RECRUITER_RELEVANCES = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const satisfies readonly LinkedinRecruiterRelevance[];

export const LINKEDIN_TIMELINESS = [
  "EVERGREEN",
  "TIMELY",
  "EXPIRED",
] as const satisfies readonly LinkedinTimeliness[];

export const LINKEDIN_TONES = [
  "PROFESSIONAL",
  "CONVERSATIONAL",
  "TECHNICAL",
  "REFLECTIVE",
  "DIRECT",
  "EDUCATIONAL",
] as const satisfies readonly LinkedinContentTone[];

export const LINKEDIN_LANGUAGES = [
  "ENGLISH",
  "ARABIC",
  "TURKISH",
] as const satisfies readonly LinkedinContentLanguage[];

export const LINKEDIN_QA_STATUSES = [
  "PASS",
  "NEEDS_REVIEW",
  "BLOCKED",
] as const satisfies readonly LinkedinPostQaStatus[];

export const LINKEDIN_GENERATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const satisfies readonly LinkedinPostGenerationStatus[];

export const LINKEDIN_TRANSFORM_TYPES = [
  "SHORTEN",
  "EXPAND",
  "MAKE_TECHNICAL",
  "MAKE_CONVERSATIONAL",
  "IMPROVE_HOOK",
  "REMOVE_CLICHES",
  "RECRUITER_FOCUSED",
  "SIMPLIFY",
  "TRANSLATE",
  "ALTERNATIVE_VERSION",
] as const;

export type LinkedinTransformType = (typeof LINKEDIN_TRANSFORM_TYPES)[number];

export const LINKEDIN_POST_LENGTHS = ["SHORT", "MEDIUM", "LONG"] as const;
export type LinkedinPostLength = (typeof LINKEDIN_POST_LENGTHS)[number];

export const LINKEDIN_IDEA_SOURCES = [
  "PROJECT",
  "SKILL",
  "RECENT_APPLICATION_PATTERN",
  "JOB_REQUIREMENT_PATTERN",
  "CAREER_PROGRESS",
  "LEARNING_ACTIVITY",
  "COMMUNICATION_CONTEXT",
  "USER_PROMPT",
  "EVERGREEN_STRATEGY",
] as const;

export type LinkedinIdeaSource = (typeof LINKEDIN_IDEA_SOURCES)[number];

export const LINKEDIN_EVIDENCE_KINDS = [
  "SKILL",
  "PROJECT",
  "ROLE",
  "EDUCATION",
  "CERTIFICATION",
  "WORK_HISTORY",
  "JOB_PATTERN",
  "CAREER_PROGRESS",
  "LEARNING",
  "THEME",
] as const;

export type LinkedinEvidenceKind = (typeof LINKEDIN_EVIDENCE_KINDS)[number];

export type LinkedinEvidenceItem = {
  id: string;
  kind: LinkedinEvidenceKind;
  label: string;
  detail?: string;
  strength?: LinkedinEvidenceStrength;
};

export type LinkedinWarning = {
  code: string;
  message: string;
};

export type LinkedinProfileSnapshot = {
  headline?: string | null;
  about?: string | null;
  currentRole?: string | null;
  featuredItems?: string[];
  topSkills?: string[];
};

export type LinkedinCareerContext = {
  targetRoles: string[];
  verifiedSkills: string[];
  projects: string[];
  education: string[];
  workHistory: string[];
  certifications: string[];
  resumeSummary: string | null;
  careerHeadline: string | null;
  jobRequirementPatterns: Array<{ name: string; count: number }>;
  recentApplicationPatterns: Array<{ title: string; company: string; status: string }>;
  professionalThemes: string[];
  evidence: LinkedinEvidenceItem[];
  warnings: LinkedinWarning[];
  fingerprint: string;
};

export type LinkedinPriorityBreakdown = {
  careerRelevance: number;
  evidenceStrength: number;
  audienceFit: number;
  pillarFit: number;
  freshness: number;
  total: number;
};

export type LinkedinVisibilityGap = {
  topic: string;
  hasEvidence: boolean;
  evidenceLabel: string | null;
  recentCoverage: number;
  recommendation: "POST" | "BUILD_EVIDENCE";
  reason: string;
};

export type LinkedinStrategyView = {
  id: string;
  status: LinkedinGrowthStrategyStatus;
  primaryGoal: LinkedinGrowthGoal;
  secondaryGoals: LinkedinGrowthGoal[];
  targetRoleTitles: string[];
  targetAudience: string[];
  positioningStatement: string | null;
  professionalThemes: string[];
  contentTone: LinkedinContentTone;
  preferredLanguage: LinkedinContentLanguage;
  postingFrequencyTarget: number | null;
  visibilityGoal: string | null;
  recruiterGoal: string | null;
  networkGoal: string | null;
  profileSnapshot: LinkedinProfileSnapshot | null;
  lastStrategyRefreshAt: string | null;
  createdAt: string;
  updatedAt: string;
  warnings: LinkedinWarning[];
  pillars: LinkedinPillarView[];
};

export type LinkedinPillarView = {
  id: string;
  name: string;
  slug: string;
  description: string;
  goal: string | null;
  audience: string | null;
  priority: LinkedinContentPillarPriority;
  evidenceSources: string[];
  exampleAngles: string[];
  isActive: boolean;
};

export type LinkedinIdeaView = {
  id: string;
  pillarId: string | null;
  pillarName: string | null;
  title: string;
  angle: string;
  summary: string;
  format: LinkedinContentFormat;
  objective: LinkedinPostObjective;
  audience: string | null;
  evidenceStrength: LinkedinEvidenceStrength;
  recruiterRelevance: LinkedinRecruiterRelevance;
  timeliness: LinkedinTimeliness;
  expiresAt: string | null;
  priorityScore: number;
  priorityBreakdown?: LinkedinPriorityBreakdown;
  status: LinkedinContentIdeaStatus;
  why: string;
  createdAt: string;
};

export type LinkedinRevisionView = {
  id: string;
  revisionNumber: number;
  source: LinkedinPostRevisionSource;
  hook: string;
  body: string;
  cta: string | null;
  tone: LinkedinContentTone;
  language: LinkedinContentLanguage;
  hashtags: string[];
  mentions: string[];
  evidence: LinkedinEvidenceItem[];
  warnings: LinkedinWarning[];
  qaStatus: LinkedinPostQaStatus | null;
  qaFingerprint: string | null;
  generationStatus: LinkedinPostGenerationStatus;
  aiSource: string | null;
  model: string | null;
  createdAt: string;
};

export type LinkedinPublishingPlanView = {
  id: string;
  postId: string;
  revisionId: string;
  revisionNumber: number;
  status: LinkedinPublishingPlanStatus;
  publishMode: LinkedinPublishMode;
  plannedPublishAt: string | null;
  timezone: string | null;
  publishedAt: string | null;
  publishingSource: LinkedinPublishingSource | null;
  newerActiveRevision: boolean;
  newerRevisionWarning: string | null;
};

export type LinkedinPerformanceSnapshotView = {
  id: string;
  capturedAt: string;
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  reposts: number | null;
  saves: number | null;
  profileViews: number | null;
  newFollowers: number | null;
  connectionRequests: number | null;
  recruiterMessages: number | null;
  source: LinkedinPerformanceSource;
  notes: string | null;
  engagementCount: number | null;
  engagementRate: number | null;
};

export type LinkedinPostView = {
  id: string;
  status: LinkedinPostStatus;
  objective: LinkedinPostObjective;
  format: LinkedinContentFormat;
  intendedAudience: string | null;
  pillarId: string | null;
  pillarName: string | null;
  ideaId: string | null;
  activeRevisionId: string | null;
  publishedAt: string | null;
  publishingSource: LinkedinPublishingSource | null;
  externalLinkedInUrl: string | null;
  createdAt: string;
  updatedAt: string;
  activeRevision: LinkedinRevisionView | null;
  revisions: LinkedinRevisionView[];
  publishingPlans: LinkedinPublishingPlanView[];
  performances: LinkedinPerformanceSnapshotView[];
};

export type LinkedinInsightView = {
  id: string;
  type: LinkedinGrowthInsightType;
  title: string;
  summary: string;
  confidence: string;
  status: LinkedinGrowthInsightStatus;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export type LinkedinOverviewView = {
  strategy: LinkedinStrategyView | null;
  readyDraftCount: number;
  scheduledCount: number;
  publishedThisMonth: number;
  nextRecommendation: LinkedinIdeaView | null;
  visibilityGaps: LinkedinVisibilityGap[];
  recentPerformance: LinkedinPerformanceSnapshotView[];
};

export type LinkedinCapabilityCardId =
  | "IDENTITY"
  | "EMAIL"
  | "PUBLISH_MEMBER_POST"
  | "POST_ANALYTICS"
  | "PROFILE_ANALYTICS"
  | "HISTORICAL_POST_READ"
  | "COMMENTS_READ"
  | "REACTIONS_READ"
  | "ORGANIZATION_PUBLISH";
