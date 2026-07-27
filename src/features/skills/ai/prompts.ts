import type { SkillsInsightAnalysisInput } from "./types";

export const SKILLS_INSIGHT_SYSTEM_PROMPT = `You are a career skills strategist. Return concise, actionable skills intelligence as strict JSON only.

Rules:
- Valid JSON only. No markdown. No commentary outside JSON.
- Base claims only on provided saved job analyses and resume skills.
- Do not invent skills or credentials.
- Do not tell the user to claim skills they lack.
- Separate "learn this" from "add to resume".
- prioritySkills.skill MUST be a real market skill name only (e.g. "Docker", "Java Spring Boot", "PostgreSQL").
- NEVER use resume-fix sentences as skills: no "Add skills section", "Include certifications", "Quantified Achievements", "Teamwork", "Soft Skills".
- Reject verbs like Add/Include/Clarify/Improve as skill names.
- Keep every string short and concrete.
- skillCoverageScore: integer 0-100.
- priority: "High" | "Medium" | "Low".
- evidenceStatus: "missing_from_resume" | "partially_supported" | "supported" | "needs_proof_first".
- For each priority skill include: skill, priority, evidenceStatus, whyThisMatters, currentEvidence, learningTarget, proofProject, estimatedHours, resumeRule, resumeSafe.
- projectIdeas must be concrete runnable projects with title, description, skillsCovered, output, estimatedHours, resumeProof. No generic titles like "Open-Source Contribution" or "Certification Preparation Project".
- Hard output limits: prioritySkills max 6, learningRoadmap max 4, projectIdeas max 4, resumeSkillAdvice max 6, marketSignals max 5, warnings max 4.`;

export function buildSkillsInsightUserPrompt(input: SkillsInsightAnalysisInput): string {
  const resume = input.resume;
  const overview = input.overview;

  const jobsSection =
    input.jobs.length === 0
      ? "None — return empty prioritySkills and warn that jobs are required."
      : input.jobs
          .map(
            (job, index) =>
              `${index + 1}. ${job.title} | score:${job.matchScore} | align:${job.roleAlignment} | matched:[${job.matchedSkills.join(", ") || "-"}] | missing:[${job.missingSkills.join(", ") || "-"}] | signals:[${job.jobSignals.join("; ") || "-"}]`,
          )
          .join("\n");

  const prioritySkillsText = overview.prioritySkills
    .filter((item) => item.skill.split(" ").length <= 5)
    .map((item) => `${item.skill}(${item.priority}):${item.demandSignal}`)
    .join("; ");

  return `Return concise skills intelligence JSON.

RESUME: role=${resume.detectedRole} | level=${resume.experienceLevel} | completeness=${resume.completenessScore}
skills=[${resume.detectedSkills.join(", ") || "-"}]

JOBS (${input.jobs.length}):
${jobsSection}

OVERVIEW: coverage=${overview.skillCoverageScore} | jobGaps=[${overview.missingSkillsFromJobs.join(", ") || "-"}] | jobMatches=[${overview.matchedSkillsFromJobs.join(", ") || "-"}]
priorities=[${prioritySkillsText || "-"}]

Important: Do not convert resume advice/ATS tips into prioritySkills.skill values. Project ideas must be concrete portfolio artifacts.

JSON keys: skillCoverageScore, prioritySkills, learningRoadmap, projectIdeas, resumeSkillAdvice, marketSignals, warnings`;
}
