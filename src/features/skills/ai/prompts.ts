import type { SkillsInsightAnalysisInput } from "./types";

export const SKILLS_INSIGHT_SYSTEM_PROMPT = `You are a career skills strategist. Return concise, actionable skills intelligence as strict JSON only.

Rules:
- Valid JSON only. No markdown. No commentary outside JSON.
- Base claims only on provided data. Do not invent skills or credentials.
- Do not tell the user to claim skills they lack.
- Separate "learn this" from "add to resume".
- Keep every string short: reasons 1 sentence, evidence 1 short phrase.
- skillCoverageScore: integer 0-100.
- priority: "High" | "Medium" | "Low".
- action: "Add evidence first" | "Add to resume" | "Do not add yet".
- resumeSafe: true only when resume already supports the skill.
- Hard output limits: prioritySkills max 6, learningRoadmap max 4, projectIdeas max 4, resumeSkillAdvice max 6, marketSignals max 5, warnings max 4.`;

export function buildSkillsInsightUserPrompt(input: SkillsInsightAnalysisInput): string {
  const resume = input.resume;
  const overview = input.overview;

  const jobsSection =
    input.jobs.length === 0
      ? "None"
      : input.jobs
          .map(
            (job, index) =>
              `${index + 1}. ${job.title} | score:${job.matchScore} | align:${job.roleAlignment} | matched:[${job.matchedSkills.join(", ") || "-"}] | missing:[${job.missingSkills.join(", ") || "-"}] | signals:[${job.jobSignals.join("; ") || "-"}]${job.resumeTailoringTips.length > 0 ? ` | tips:[${job.resumeTailoringTips.join("; ")}]` : ""}`,
          )
          .join("\n");

  const prioritySkillsText = overview.prioritySkills
    .map((item) => `${item.skill}(${item.priority}):${item.demandSignal}`)
    .join("; ");

  return `Return concise skills intelligence JSON.

RESUME: role=${resume.detectedRole} | level=${resume.experienceLevel} | completeness=${resume.completenessScore}
skills=[${resume.detectedSkills.join(", ") || "-"}]
strengths=[${resume.strengths.join("; ") || "-"}]
weaknesses=[${resume.weaknesses.join("; ") || "-"}]
focus=[${resume.suggestedFocus.join("; ") || "-"}]

JOBS (${input.jobs.length}):
${jobsSection}

OVERVIEW: coverage=${overview.skillCoverageScore} | jobGaps=[${overview.missingSkillsFromJobs.join(", ") || "-"}] | jobMatches=[${overview.matchedSkillsFromJobs.join(", ") || "-"}]
priorities=[${prioritySkillsText || "-"}]
tips=[${overview.recommendations.join("; ") || "-"}]

JSON keys: skillCoverageScore, prioritySkills, learningRoadmap, projectIdeas, resumeSkillAdvice, marketSignals, warnings`;
}
