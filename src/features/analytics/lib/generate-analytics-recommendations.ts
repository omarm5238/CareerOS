import type {
  AnalyticsJobsMetrics,
  AnalyticsResumeMetrics,
  AnalyticsSkillsMetrics,
} from "../types";

type GenerateAnalyticsRecommendationsInput = {
  resume: AnalyticsResumeMetrics;
  jobs: AnalyticsJobsMetrics;
  skills: AnalyticsSkillsMetrics;
};

export function generateAnalyticsRecommendations(
  input: GenerateAnalyticsRecommendationsInput,
): string[] {
  const recommendations: string[] = [];
  const { resume, jobs, skills } = input;

  if (!resume.hasResume) {
    recommendations.push("Upload a resume to unlock career analytics and profile insights.");
  }

  if (
    resume.hasResume &&
    resume.completenessScore !== null &&
    resume.completenessScore < 70
  ) {
    recommendations.push(
      "Your resume completeness is below 70%. Review the Resume module action plan to strengthen your profile.",
    );
  }

  if (resume.hasResume && jobs.savedJobsCount === 0) {
    recommendations.push("Add saved jobs to benchmark your profile against real market requirements.");
  }

  if (
    jobs.savedJobsCount > 0 &&
    jobs.averageMatchScore !== null &&
    jobs.averageMatchScore < 60
  ) {
    recommendations.push(
      "Your average job match is below 60%. Target priority skills from the Skills module to improve alignment.",
    );
  }

  if (skills.gapsCount >= 3) {
    recommendations.push(
      "Multiple skill gaps detected across saved jobs. Use the Skills module to prioritize what to learn next.",
    );
  }

  if (jobs.strongMatchesCount > 0) {
    recommendations.push(
      "You have at least one strong job match. Review your best-matching saved job and tailor applications accordingly.",
    );
  }

  if (resume.hasResume && resume.detectedSkillsCount === 0) {
    recommendations.push(
      "No skills were detected on your resume. Upload a more detailed resume with an explicit skills section.",
    );
  }

  if (recommendations.length === 0 && resume.hasResume) {
    recommendations.push(
      "Keep your resume updated and continue saving jobs to maintain accurate career analytics.",
    );
  }

  return recommendations.slice(0, 6);
}
