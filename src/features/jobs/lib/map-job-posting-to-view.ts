import type { JobDetailView, JobListItem, RoleAlignment } from "../types";

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

type JobRecord = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  description: string;
  source: string | null;
  createdAt: Date;
  analysis: {
    matchScore: number;
    roleAlignment: string;
    matchedSkills: unknown;
    missingSkills: unknown;
    resumeSignals: unknown;
    jobSignals: unknown;
    recommendations: unknown;
  } | null;
};

export function mapJobPostingToListItem(job: JobRecord): JobListItem {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    source: job.source,
    createdAt: job.createdAt.toISOString(),
    analysis: job.analysis
      ? {
          matchScore: job.analysis.matchScore,
          roleAlignment: parseRoleAlignment(job.analysis.roleAlignment),
          matchedSkillsCount: parseStringArray(job.analysis.matchedSkills).length,
          missingSkillsCount: parseStringArray(job.analysis.missingSkills).length,
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
    analysis: job.analysis
      ? {
          matchScore: job.analysis.matchScore,
          roleAlignment: parseRoleAlignment(job.analysis.roleAlignment),
          matchedSkills: parseStringArray(job.analysis.matchedSkills),
          missingSkills: parseStringArray(job.analysis.missingSkills),
          resumeSignals: parseStringArray(job.analysis.resumeSignals),
          jobSignals: parseStringArray(job.analysis.jobSignals),
          recommendations: parseStringArray(job.analysis.recommendations),
        }
      : null,
  };
}
