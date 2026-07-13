import type { CareerHealthLabel, CareerHealthResult } from "../types";

type GenerateCareerHealthScoreInput = {
  hasResume: boolean;
  completenessScore: number | null;
  skillCoverageScore: number | null;
  savedJobsCount: number;
  averageMatchScore: number | null;
};

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function scoreResumeCompleteness(completenessScore: number | null): number {
  if (completenessScore === null) return 0;
  return (completenessScore / 100) * 35;
}

function scoreSkillsCoverage(skillCoverageScore: number | null): number {
  if (skillCoverageScore === null) return 0;
  return (skillCoverageScore / 100) * 25;
}

function scoreJobsActivity(savedJobsCount: number): number {
  if (savedJobsCount <= 0) return 0;
  if (savedJobsCount === 1) return 8;
  if (savedJobsCount === 2) return 12;
  if (savedJobsCount === 3) return 16;
  return 20;
}

function scoreJobMatchQuality(averageMatchScore: number | null): number {
  if (averageMatchScore === null) return 0;
  return (averageMatchScore / 100) * 20;
}

function resolveLabel(score: number, hasResume: boolean): CareerHealthLabel {
  if (!hasResume || score < 15) return "Not Enough Data";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs Work";
}

function buildExplanation(
  score: number,
  label: CareerHealthLabel,
  input: GenerateCareerHealthScoreInput,
): string {
  if (!input.hasResume) {
    return "Upload a resume to establish your career baseline and unlock analytics.";
  }

  if (input.savedJobsCount === 0) {
    return "Your resume profile is in place, but adding saved jobs will improve readiness insights.";
  }

  if (label === "Strong") {
    return "Strong alignment across resume completeness, skills coverage, and job match quality.";
  }

  if (label === "Developing") {
    return "Solid foundation with room to improve job matches and close skill gaps.";
  }

  if (label === "Needs Work") {
    return "Focus on resume completeness, targeted skills, and stronger job alignment.";
  }

  if (score < 15) {
    return "Limited data available. Complete onboarding and add jobs to build your analytics profile.";
  }

  return "Continue building your profile with resume updates and saved job analyses.";
}

export function generateCareerHealthScore(
  input: GenerateCareerHealthScoreInput,
): CareerHealthResult {
  const score = clampScore(
    scoreResumeCompleteness(input.completenessScore) +
      scoreSkillsCoverage(input.skillCoverageScore) +
      scoreJobsActivity(input.savedJobsCount) +
      scoreJobMatchQuality(input.averageMatchScore),
  );

  const label = resolveLabel(score, input.hasResume);
  const explanation = buildExplanation(score, label, input);

  return { score, label, explanation };
}
