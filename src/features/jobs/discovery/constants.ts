// ---------------------------------------------------------------------------
// Milestone 23 — Discovery & Queue constants
// ---------------------------------------------------------------------------

export const MAX_PROVIDER_REQUESTS_PER_RUN = 4;
export const MAX_RESULTS_PER_PROVIDER = 50;
export const MAX_QUERY_VARIANTS = 6;
export const PROVIDER_TIMEOUT_MS = 10_000;
export const AI_DEEP_RANK_LIMIT = 24;
export const AI_BATCH_SIZE = 5;
export const DISCOVERY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
export const BATCH_ADD_LIMIT = 10;
export const QUEUE_PREPARE_CONCURRENCY = 2;

export const SCORE_BAND_THRESHOLDS = {
  EXCELLENT: 85,
  STRONG: 75,
  POSSIBLE: 65,
  LOW: 0,
} as const;

export const SCORE_BAND_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  STRONG: "Strong",
  POSSIBLE: "Possible",
  LOW: "Low",
};

export const SCORE_WEIGHTS = {
  roleAlignment: 25,
  skillsOverlap: 30,
  experienceSeniority: 15,
  evidenceStrength: 10,
  locationWorkMode: 10,
  freshness: 5,
  employmentType: 5,
} as const;

export const DISMISS_REASONS = [
  "Not interested",
  "Wrong location",
  "Wrong seniority",
  "Wrong technology",
  "Duplicate/irrelevant",
  "Other",
] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  REMOTIVE: "Remotive",
  ARBEITNOW: "Arbeitnow",
  ADZUNA: "Adzuna",
  JOOBLE: "Jooble",
};

export const ADZUNA_SUPPORTED_COUNTRIES: Record<string, string> = {
  gb: "United Kingdom",
  us: "United States",
  de: "Germany",
  fr: "France",
  nl: "Netherlands",
  au: "Australia",
  ca: "Canada",
  in: "India",
  pl: "Poland",
  at: "Austria",
  br: "Brazil",
  za: "South Africa",
  it: "Italy",
  es: "Spain",
  sg: "Singapore",
};

export const JOOBLE_REGIONAL_ENDPOINTS: Record<string, string> = {
  US: "https://jooble.org/api/",
  UK: "https://gb.jooble.org/api/",
  DE: "https://de.jooble.org/api/",
  TR: "https://tr.jooble.org/api/",
};
