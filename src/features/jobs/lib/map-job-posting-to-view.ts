import { parseApplicationStatus } from "../constants/application-status";
import type {
  JobAnalysisSource,
  JobDetailView,
  JobListItem,
  JobMatchAnalysis,
  RoleAlignment,
} from "../types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseRoleAlignment(value: unknown): RoleAlignment {
  if (
    value === "Strong" ||
    value === "Partial" ||
    value === "Weak" ||
    value === "Unknown"
  ) {
    return value;
  }
  return "Unknown";
}

function parseAnalysisSource(value: unknown): JobAnalysisSource {
  return value === "ai" ? "ai" : "rule_based";
}

type JobRecord = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  description: string;
  source: string | null;
  applicationStatus: string;
  applicationNotes: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  analysis: {
    matchScore: number;
    roleAlignment: string;
    matchedSkills: unknown;
    missingSkills: unknown;
    resumeSignals: unknown;
    jobSignals: unknown;
    recommendations: unknown;
    analysisSource?: string | null;
    aiModel?: string | null;
    fitSummary?: string | null;
    applicationStrategy?: unknown;
    resumeTailoringTips?: unknown;
    aiWarnings?: unknown;
  } | null;
};

function mapApplicationFields(job: JobRecord) {
  return {
    applicationStatus: parseApplicationStatus(job.applicationStatus),
    applicationNotes: job.applicationNotes,
    appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
  };
}

function mapAnalysisRecord(
  analysis: NonNullable<JobRecord["analysis"]>,
): JobMatchAnalysis {
  return {
    matchScore: analysis.matchScore,
    roleAlignment: parseRoleAlignment(analysis.roleAlignment),
    matchedSkills: parseStringArray(analysis.matchedSkills),
    missingSkills: parseStringArray(analysis.missingSkills),
    resumeSignals: parseStringArray(analysis.resumeSignals),
    jobSignals: parseStringArray(analysis.jobSignals),
    recommendations: parseStringArray(analysis.recommendations),
    analysisSource: parseAnalysisSource(analysis.analysisSource),
    aiModel: analysis.aiModel ?? null,
    fitSummary: analysis.fitSummary ?? null,
    applicationStrategy: parseStringArray(analysis.applicationStrategy),
    resumeTailoringTips: parseStringArray(analysis.resumeTailoringTips),
    aiWarnings: parseStringArray(analysis.aiWarnings),
  };
}

export function mapJobPostingToListItem(job: JobRecord): JobListItem {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    source: job.source,
    createdAt: job.createdAt.toISOString(),
    ...mapApplicationFields(job),
    analysis: job.analysis
      ? {
          matchScore: job.analysis.matchScore,
          roleAlignment: parseRoleAlignment(job.analysis.roleAlignment),
          matchedSkillsCount: parseStringArray(job.analysis.matchedSkills).length,
          missingSkillsCount: parseStringArray(job.analysis.missingSkills).length,
          analysisSource: parseAnalysisSource(job.analysis.analysisSource),
        }
      : null,
  };
}

export function mapJobPostingToDetailView(job: JobRecord): JobDetailView {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    jobUrl: job.jobUrl,
    description: job.description,
    source: job.source,
    createdAt: job.createdAt.toISOString(),
    ...mapApplicationFields(job),
    analysis: job.analysis ? mapAnalysisRecord(job.analysis) : null,
  };
}
