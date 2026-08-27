import { partitionRequirements } from "@/features/shared/insights/classify-requirement";

import type { ResumeVersionInputSnapshot } from "../types";
import type { ResumeTailoringInput } from "./types";

const RESUME_TEXT_LIMIT = 6_000;
const JOB_DESCRIPTION_LIMIT = 3_200;

type ResumeAnalysisRecord = {
  id: string;
  detectedRole: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkills: unknown;
  suggestedFocus: unknown;
  profileSummary: string | null;
  strengths: unknown;
  weaknesses: unknown;
  atsRecommendations: unknown;
};

type JobAnalysisRecord = {
  id: string;
  matchScore: number;
  roleAlignment: string;
  matchedSkills: unknown;
  missingSkills: unknown;
  applicationStrategy: unknown;
  resumeTailoringTips: unknown;
};

export type BuildResumeTailoringInputArgs = {
  userId: string;
  resumeDocument: {
    id: string;
    filename: string;
    textPreview: string;
    analysis: ResumeAnalysisRecord | null;
  };
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    description: string;
    analysis: JobAnalysisRecord | null;
  };
};

function toStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }

  return result;
}

function truncate(value: string, limit: number): { text: string; truncated: boolean } {
  const normalized = value.trim();
  if (normalized.length <= limit) {
    return { text: normalized, truncated: false };
  }
  return { text: `${normalized.slice(0, limit).trimEnd()}…`, truncated: true };
}

export function buildResumeTailoringInput(
  args: BuildResumeTailoringInputArgs,
): ResumeTailoringInput {
  const analysis = args.resumeDocument.analysis;
  const jobAnalysis = args.job.analysis;

  const resumeText = truncate(args.resumeDocument.textPreview ?? "", RESUME_TEXT_LIMIT);
  const jobDescription = truncate(args.job.description ?? "", JOB_DESCRIPTION_LIMIT);

  const missingSkillsRaw = toStringArray(jobAnalysis?.missingSkills, 30);
  const partitioned = partitionRequirements(missingSkillsRaw);

  return {
    userId: args.userId,
    resume: {
      resumeDocumentId: args.resumeDocument.id,
      resumeAnalysisId: analysis?.id ?? null,
      filename: args.resumeDocument.filename,
      textPreview: resumeText.text,
      textPreviewTruncated: resumeText.truncated,
      detectedRole: analysis?.detectedRole ?? "Unknown role",
      experienceLevel: analysis?.experienceLevel ?? "Unknown",
      completenessScore: analysis?.completenessScore ?? 0,
      detectedSkills: toStringArray(analysis?.detectedSkills, 30),
      profileSummary: analysis?.profileSummary ?? null,
      strengths: toStringArray(analysis?.strengths, 8),
      weaknesses: toStringArray(analysis?.weaknesses, 8),
      suggestedFocus: toStringArray(analysis?.suggestedFocus, 8),
      atsRecommendations: toStringArray(analysis?.atsRecommendations, 8),
    },
    job: {
      jobId: args.job.id,
      jobAnalysisId: jobAnalysis?.id ?? null,
      title: args.job.title,
      company: args.job.company,
      location: args.job.location,
      description: jobDescription.text,
      descriptionTruncated: jobDescription.truncated,
      matchScore: jobAnalysis?.matchScore ?? null,
      roleAlignment: jobAnalysis?.roleAlignment ?? null,
      matchedSkills: toStringArray(jobAnalysis?.matchedSkills, 20),
      missingSkills: partitioned.skill.slice(0, 20),
      nonSkillBlockers: [
        ...partitioned.experience_gap,
        ...partitioned.evidence_gap,
        ...partitioned.context_requirement,
      ].slice(0, 10),
      resumeTailoringTips: toStringArray(jobAnalysis?.resumeTailoringTips, 8),
      applicationStrategy: toStringArray(jobAnalysis?.applicationStrategy, 6),
    },
  };
}

export function buildResumeVersionInputSnapshot(
  input: ResumeTailoringInput,
): ResumeVersionInputSnapshot {
  return {
    resumeDocumentId: input.resume.resumeDocumentId,
    resumeAnalysisId: input.resume.resumeAnalysisId,
    targetJobId: input.job.jobId,
    targetJobAnalysisId: input.job.jobAnalysisId,
    jobTitle: input.job.title,
    company: input.job.company,
    matchScore: input.job.matchScore,
    topSkillGaps: input.job.missingSkills.slice(0, 10),
    nonSkillBlockers: input.job.nonSkillBlockers.slice(0, 10),
  };
}
