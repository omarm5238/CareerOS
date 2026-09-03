// ---------------------------------------------------------------------------
// Milestone 23 — Job Discovery & Application Queue — Types
// ---------------------------------------------------------------------------

export type RoleTargetPriority = "high" | "medium" | "low";
export type RoleTargetConfidence = "strong" | "medium" | "weak";

export interface JobDiscoveryRoleTarget {
  title: string;
  aliases: string[];
  priority: RoleTargetPriority;
  confidence: RoleTargetConfidence;
  evidence: string[];
  enabled: boolean;
}

export interface JobDiscoveryLocationTarget {
  countryCode: string;
  country: string;
  cities: string[];
  enabled: boolean;
}

export type WorkAuthStatus = "KNOWN_ELIGIBLE" | "SPONSORSHIP_REQUIRED" | "UNKNOWN";

export interface WorkAuthorizationPreferences {
  [countryCode: string]: WorkAuthStatus;
}

export interface ProviderPreferences {
  REMOTIVE?: boolean;
  ARBEITNOW?: boolean;
  ADZUNA?: boolean;
  JOOBLE?: boolean;
}

export interface JobDiscoveryProfileData {
  roleTargets: JobDiscoveryRoleTarget[];
  locationTargets: JobDiscoveryLocationTarget[];
  workModes: string[];
  employmentTypes: string[];
  experienceLevels: string[];
  includedKeywords: string[];
  excludedKeywords: string[];
  workAuthorization: WorkAuthorizationPreferences;
  visaPreference: string | null;
  freshnessDays: number;
  minimumSuitabilityScore: number;
  dailyTarget: number;
  providerPreferences: ProviderPreferences;
}

// Provider types
export type DiscoveryProviderName = "REMOTIVE" | "ARBEITNOW" | "ADZUNA" | "JOOBLE";

export interface ProviderJobResult {
  provider: DiscoveryProviderName;
  externalId: string | null;
  title: string;
  company: string;
  location: string | null;
  countryCode: string | null;
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "TEMPORARY" | "OTHER" | "UNKNOWN";
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  sourceUrl: string;
  applyUrl: string | null;
  remote: boolean | null;
  visaSponsorship: boolean | null;
  sourceMetadata: Record<string, unknown>;
}

export interface ProviderSearchRequest {
  keywords: string[];
  location?: string;
  countryCode?: string;
  workMode?: string;
  page?: number;
  limit?: number;
}

export interface ProviderRunStats {
  provider: DiscoveryProviderName;
  configured: boolean;
  requestsMade: number;
  rawResults: number;
  normalizedResults: number;
  durationMs: number;
  status: "success" | "partial" | "failed" | "skipped";
}

export interface ProviderError {
  provider: DiscoveryProviderName;
  category: "NOT_CONFIGURED" | "TIMEOUT" | "RATE_LIMITED" | "AUTH_FAILED" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "UNKNOWN";
  message: string;
}

export interface ProviderAttribution {
  provider: DiscoveryProviderName;
  providerLabel: string;
  sourceUrl: string;
  applyUrl: string | null;
}

// Scoring types
export interface DiscoveryScoreBreakdown {
  roleAlignment: number;
  skillsOverlap: number;
  experienceSeniority: number;
  evidenceStrength: number;
  locationWorkMode: number;
  freshness: number;
  employmentType: number;
  total: number;
}

export interface DiscoveryCandidateDetail {
  id: string;
  title: string;
  normalizedTitle: string;
  company: string;
  normalizedCompany: string;
  location: string | null;
  countryCode: string | null;
  workMode: string;
  employmentType: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  canonicalFingerprint: string;
  deterministicScore: number | null;
  aiScore: number | null;
  finalScore: number | null;
  scoreBand: string | null;
  matchSummary: string | null;
  matchedSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  softBlockers: string[];
  evidence: string[];
  warnings: string[];
  analysisSource: string | null;
  discoveryStatus: string;
  sources: ProviderAttribution[];
  dismissedAt: string | null;
  dismissedReason: string | null;
  jobPostingId: string | null;
  queueItemId: string | null;
  queueStatus: string | null;
  applicationId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  timesSeen: number;
}

export interface DiscoveryListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string;
  finalScore: number | null;
  scoreBand: string | null;
  matchSummary: string | null;
  matchedSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  softBlockers: string[];
  evidence: string[];
  warnings: string[];
  analysisSource: string | null;
  discoveryStatus: string;
  postedAt: string | null;
  providers: string[];
  sourceUrl: string | null;
  dismissedAt: string | null;
  jobPostingId: string | null;
  queueItemId: string | null;
  queueStatus: string | null;
  applicationId: string | null;
}

// Queue types
export type QueuePreparationState =
  | "NOT_PREPARED"
  | "PREPARING"
  | "NEEDS_RESUME_REVIEW"
  | "READY_TO_APPLY"
  | "APPLICATION_STARTED"
  | "FAILED";

export interface QueuePreparationSnapshot {
  jobPostingCreated?: boolean;
  jobAnalysisId?: string | null;
  resumeVersionId?: string | null;
  resumeStatus?: string | null;
  lastStep?: string;
  warnings?: string[];
}

export interface ApplicationQueueListItem {
  id: string;
  discoveredJobId: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string;
  discoveryScore: number | null;
  scoreBand: string | null;
  priority: string;
  queueStatus: string;
  preparationState: QueuePreparationState;
  jobPostingId: string | null;
  resumeVersionId: string | null;
  resumeVersionTitle: string | null;
  resumeStatus: string | null;
  applicationId: string | null;
  preparationError: string | null;
  sourceUrl: string | null;
  providers: string[];
  queuedAt: string;
}

// AI deep ranking
export interface AiDeepRankCandidate {
  candidateId: string;
  aiSuitability: number;
  matchSummary: string;
  strongEvidence: string[];
  missingSkills: string[];
  softBlockers: string[];
  hardBlockers: string[];
  recommendation: "strong" | "possible" | "low";
  warnings: string[];
}

// Query snapshot
export interface DiscoveryQuerySnapshot {
  roleTargets: string[];
  locations: string[];
  workModes: string[];
  freshnessDays: number;
  minimumSuitabilityScore: number;
  enabledProviders: DiscoveryProviderName[];
  queryVariants: string[];
}

// Discovery run result for client
export interface DiscoveryRunResult {
  runId: string;
  status: string;
  rawFoundCount: number;
  normalizedCount: number;
  duplicateCount: number;
  hardRejectedCount: number;
  scoredCount: number;
  strongMatchCount: number;
  providerStats: ProviderRunStats[];
  providerErrors: ProviderError[];
  durationMs: number;
}
