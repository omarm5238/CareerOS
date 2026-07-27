import { MAX_PRIORITY_SKILLS } from "../constants";
import {
  isValidSkillName,
  estimateLearningEffort,
  isTechnicalSkillRequirement,
  partitionRequirements,
  ZERO_JOBS_UNLOCK_MESSAGE,
} from "@/features/shared/insights";
import { countNonEmptyCategories, groupSkillsByCategory } from "./group-skills-by-category";
import {
  buildSelectedJobProjectIdeas,
  shortJobDisplayTitle,
} from "./build-selected-job-project-ideas";
import type {
  JobSkillsSnapshot,
  PrioritySkillItem,
  SkillPriority,
  SkillsOverview,
} from "../types";

type GenerateSkillsOverviewInput = {
  resumeDetectedSkills: string[];
  resumeRole: string | null;
  resumeExperienceLevel: string | null;
  resumeCompletenessScore: number | null;
  resumeSuggestedFocus: string[];
  resumeWeaknesses: string[];
  jobs: JobSkillsSnapshot[];
  selectedJobId?: string | null;
  selectedJobTitle?: string | null;
  selectedJobCompany?: string | null;
  mode?: "selected" | "all_jobs";
};

function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function countMissingSkillOccurrences(
  jobs: JobSkillsSnapshot[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const job of jobs) {
    for (const skill of job.missingSkills) {
      const key = skill.trim();
      if (!key) continue;
      const normalized = key.toLowerCase();
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }

  return counts;
}

function restoreDisplayName(
  normalized: string,
  jobs: JobSkillsSnapshot[],
): string {
  for (const job of jobs) {
    for (const skill of job.missingSkills) {
      if (skill.toLowerCase() === normalized) return skill;
    }
  }
  return normalized;
}

function buildMissingSkillsFromJobs(
  jobs: JobSkillsSnapshot[],
): {
  skills: string[];
  counts: Record<string, number>;
  experienceGaps: string[];
  evidenceGaps: string[];
  contextRequirements: string[];
} {
  const rawCounts = countMissingSkillOccurrences(jobs);

  const skills = Object.entries(rawCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([normalized]) => restoreDisplayName(normalized, jobs));

  const classified = partitionRequirements(skills);
  return {
    skills: dedupeSkills(classified.skill),
    counts: rawCounts,
    experienceGaps: classified.experience_gap,
    evidenceGaps: classified.evidence_gap,
    contextRequirements: classified.context_requirement,
  };
}

function buildMatchedSkillsFromJobs(jobs: JobSkillsSnapshot[]): string[] {
  return dedupeSkills(jobs.flatMap((job) => job.matchedSkills));
}

function computeSkillCoverageScore(
  detectedSkills: string[],
  jobs: JobSkillsSnapshot[],
  resumeCompletenessScore: number | null,
): number {
  if (jobs.length === 0) {
    return resumeCompletenessScore ?? 0;
  }

  const requiredRaw = dedupeSkills(
    jobs.flatMap((job) => [...job.matchedSkills, ...job.missingSkills]),
  );
  const required = partitionRequirements(requiredRaw).skill;

  if (required.length === 0) {
    return resumeCompletenessScore ?? 0;
  }

  const detectedSet = new Set(detectedSkills.map((s) => s.toLowerCase()));
  const matched = required.filter((skill) => detectedSet.has(skill.toLowerCase())).length;
  const ratio = matched / required.length;

  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function priorityFromCount(count: number): SkillPriority {
  if (count >= 2) return "High";
  if (count === 1) return "Medium";
  return "Low";
}

function buildPrioritySkills(input: GenerateSkillsOverviewInput): PrioritySkillItem[] {
  const { skills: missingSkills, counts } = buildMissingSkillsFromJobs(input.jobs);
  const detectedSet = new Set(
    input.resumeDetectedSkills.map((skill) => skill.toLowerCase()),
  );
  const priorities: PrioritySkillItem[] = [];

  for (const skill of missingSkills) {
    if (!isValidSkillName(skill) || !isTechnicalSkillRequirement(skill)) continue;
    const normalized = skill.toLowerCase();
    if (detectedSet.has(normalized)) continue;

    const jobCount = counts[normalized] ?? 1;
    const effort = estimateLearningEffort(skill);
    const shortTitle =
      input.mode === "selected"
        ? shortJobDisplayTitle(input.selectedJobTitle) ?? input.selectedJobTitle
        : null;
    const selectedLabel =
      shortTitle
        ? input.selectedJobCompany
          ? `${shortTitle} · ${input.selectedJobCompany}`
          : shortTitle
        : null;
    priorities.push({
      id: `priority-${normalized}`,
      skill,
      reason: selectedLabel
        ? `Missing for selected target job (${selectedLabel}).`
        : "This skill appears in saved job requirements but is missing from your resume profile.",
      demandSignal: selectedLabel
        ? effort.showHours
          ? `Selected-job live guidance · ${effort.label}`
          : "Selected-job live guidance"
        : jobCount === 1
          ? "Missing in 1 saved job"
          : `Missing in ${jobCount} saved jobs`,
      priority: selectedLabel ? "High" : priorityFromCount(jobCount),
      estimatedEffort: effort.showHours ? effort.label : "",
      effortRationale: effort.rationale,
    });
  }

  // With zero saved jobs there is no market signal — do not invent priority
  // skills from resume advice. The Skills module shows a Jobs CTA instead.
  return priorities
    .sort((a, b) => {
      const weight = { High: 0, Medium: 1, Low: 2 };
      return weight[a.priority] - weight[b.priority];
    })
    .slice(0, MAX_PRIORITY_SKILLS);
}

function buildRecommendations(
  detectedSkills: string[],
  jobs: JobSkillsSnapshot[],
  prioritySkills: PrioritySkillItem[],
): string[] {
  const recommendations: string[] = [
    "Add a skill to your resume only if you actually have experience with it.",
    "Use job descriptions to guide skill development priorities.",
  ];

  if (prioritySkills.length > 0) {
    recommendations.push(
      `Build a small project around high-priority missing skills such as ${prioritySkills[0].skill}.`,
    );
  }

  if (jobs.length === 0) {
    recommendations.push(ZERO_JOBS_UNLOCK_MESSAGE);
  } else if (detectedSkills.length === 0) {
    recommendations.push("Upload a more detailed resume to improve skill detection.");
  }

  return recommendations.slice(0, 4);
}

export function generateSkillsOverview(
  input: GenerateSkillsOverviewInput,
): SkillsOverview {
  const detectedSkills = dedupeSkills(input.resumeDetectedSkills);
  const groupedSkills = groupSkillsByCategory(detectedSkills);
  const {
    skills: missingSkillsFromJobs,
    counts: missingSkillJobCounts,
    experienceGaps,
    evidenceGaps,
    contextRequirements,
  } =
    buildMissingSkillsFromJobs(input.jobs);
  const matchedSkillsFromJobs = buildMatchedSkillsFromJobs(input.jobs);
  const prioritySkills = buildPrioritySkills(input);

  return {
    detectedSkills,
    groupedSkills,
    missingSkillsFromJobs,
    experienceGaps,
    evidenceGaps,
    contextRequirements,
    missingSkillJobCounts,
    prioritySkills,
    matchedSkillsFromJobs,
    skillCoverageScore: computeSkillCoverageScore(
      detectedSkills,
      input.jobs,
      input.resumeCompletenessScore,
    ),
    recommendations: buildRecommendations(
      detectedSkills,
      input.jobs,
      prioritySkills,
    ),
    projectIdeas: buildSelectedJobProjectIdeas({
      jobId: input.selectedJobId ?? (input.mode === "selected" ? input.jobs[0]?.id : null),
      jobTitle:
        input.mode === "selected"
          ? input.selectedJobTitle ?? input.jobs[0]?.title ?? null
          : null,
      company: input.mode === "selected" ? input.selectedJobCompany : null,
      missingTechnicalSkills: prioritySkills.map((item) => item.skill),
      evidenceGaps,
      mode: input.mode ?? "all_jobs",
    }),
    sourceLabel:
      input.mode === "selected" && input.selectedJobTitle
        ? "Selected-job live guidance"
        : "AI strategy: all saved jobs",
    savedJobsAnalyzedCount: input.jobs.length,
    categoryCount: countNonEmptyCategories(groupedSkills),
  };
}
