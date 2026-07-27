import type { CareerBriefAnalysisInput } from "./types";

export const CAREER_BRIEF_SYSTEM_PROMPT = `You are a practical career readiness analyst for CareerOS.

Rules:
- Base every claim on the provided structured data.
- Do not invent skills, credentials, links, awards, certifications, internships, or experience.
- Do not tell the user to claim skills they lack.
- Keep the brief concise and avoid duplicating resume improvement items.
- If saved job count is zero, do not claim market gaps or recommend job-description keywords. Include "Save one target job" under Job Actions.
- healthScore is an integer from 0 to 100.
- severity and priority are exactly "High", "Medium", or "Low".
- nextActions category is exactly "Skills", "Resume", "Jobs", or "Applications".
- actionCenter section is exactly "Job Actions", "Resume Fixes", "Skill Proof Needed", "Portfolio Proof", or "Interview Prep".
- actionCenter contains 3-5 total items across all sections, with at most 2 Resume Fixes.
- nextActions contains at most 3 executive actions. Do not repeat their exact titles in actionCenter.
- thirtyDayPlan contains exactly 4 week summaries with week, focus, and outcome.
- warnings and dataSourceNotes are human-readable and non-technical.
- Hard limits: risks 3, nextActions 3, actionCenter 5 total items, warnings 3, dataSourceNotes 4.`;

export function buildCareerBriefUserPrompt(input: CareerBriefAnalysisInput): string {
  return `Create the CareerOS Brief from this structured snapshot:\n${JSON.stringify(input)}`;
}

export function buildCareerBriefRetryPrompt(input: CareerBriefAnalysisInput): string {
  return `Return a compact CareerOS Brief. Prioritize a valid response over detail. Use only this snapshot:\n${JSON.stringify(
    {
      resume: input.resume
        ? {
            role: input.resume.detectedRole,
            level: input.resume.experienceLevel,
            completeness: input.resume.completenessScore,
            skills: input.resume.detectedSkills,
            weaknesses: input.resume.weaknesses,
            improvements: input.resume.resumeImprovementItems.slice(0, 5),
          }
        : null,
      jobs: {
        count: input.jobs.count,
        averageMatch: input.jobs.averageMatchScore,
        latest: input.jobs.latestJobs.map((job) => ({
          title: job.title,
          score: job.matchScore,
          missingSkills: job.missingSkills,
        })),
      },
      skills: {
        priorities: input.skills.prioritySkills,
        gaps: input.skills.topGaps,
      },
      health: input.analytics,
      targetJob: input.targetJob,
    },
  )}`;
}
