import {
  estimateLearningEffort,
  filterSkillLikeItems,
  isTechnicalSkillRequirement,
  isValidSkillName,
  partitionRequirements,
} from "@/features/shared/insights";
import type { ResumeModuleAnalysis } from "@/features/resume/types";
import type { TargetJobContext } from "@/features/jobs";

import { generateSkillsOverview } from "./generate-skills-overview";
import type {
  ContextualProjectIdea,
  JobSkillsSnapshot,
  PrioritySkillItem,
  SkillsInsightView,
  SkillsOverview,
} from "../types";

export type SelectedJobSkillContext = {
  selectedJob: TargetJobContext["selectedJob"];
  coverageScore: number;
  matchedSkills: string[];
  missingTechnicalSkills: string[];
  experienceGaps: string[];
  evidenceGaps: string[];
  contextRequirements: string[];
  prioritySkills: PrioritySkillItem[];
  projectIdeas: ContextualProjectIdea[];
  recommendations: string[];
  sourceLabel: string;
  overview: SkillsOverview;
};

function splitJobRequirements(input: {
  id: string;
  title: string;
  matchedSkills: string[];
  missingSkills: string[];
  jobSignals: string[];
}): { snapshot: JobSkillsSnapshot; nonSkillRequirements: string[] } {
  const partitioned = partitionRequirements(input.missingSkills);
  return {
    snapshot: {
      id: input.id,
      title: input.title,
      matchedSkills: filterSkillLikeItems(
        input.matchedSkills.filter(isTechnicalSkillRequirement),
      ),
      missingSkills: partitioned.skill.filter(
        (skill) => isValidSkillName(skill) && isTechnicalSkillRequirement(skill),
      ),
      jobSignals: input.jobSignals,
    },
    nonSkillRequirements: [
      ...partitioned.experience_gap,
      ...partitioned.evidence_gap,
      ...partitioned.context_requirement,
    ],
  };
}

export function buildSelectedJobSkillContext(input: {
  resume: ResumeModuleAnalysis;
  targetJobContext: TargetJobContext;
  allJobSnapshots: JobSkillsSnapshot[];
  mode: "selected" | "all_jobs";
  existingInsight?: SkillsInsightView | null;
}): SelectedJobSkillContext {
  const selected = input.targetJobContext.selectedJob;
  const selectedAnalysis = selected?.analysis;

  const selectedSplits =
    input.mode === "selected" && selected && selectedAnalysis
      ? [
          splitJobRequirements({
            id: selected.id,
            title: selected.title,
            matchedSkills: selectedAnalysis.matchedSkills,
            missingSkills: selectedAnalysis.missingSkills,
            jobSignals: selectedAnalysis.jobSignals,
          }),
        ]
      : [];

  const allSplits =
    input.mode === "all_jobs"
      ? input.allJobSnapshots.map((job) =>
          splitJobRequirements({
            id: job.id,
            title: job.title,
            matchedSkills: job.matchedSkills,
            missingSkills: job.missingSkills,
            jobSignals: job.jobSignals,
          }),
        )
      : [];

  const splits = input.mode === "selected" ? selectedSplits : allSplits;
  const jobs = splits.map((item) => item.snapshot);
  const extractedNonSkills = splits.flatMap((item) => item.nonSkillRequirements);

  const overview = generateSkillsOverview({
    resumeDetectedSkills: filterSkillLikeItems(input.resume.detectedSkills),
    resumeRole: input.resume.role,
    resumeExperienceLevel: input.resume.experienceLevel,
    resumeCompletenessScore: input.resume.completenessScore,
    resumeSuggestedFocus: input.resume.suggestedFocus,
    resumeWeaknesses: input.resume.weaknesses,
    jobs,
    selectedJobId: input.mode === "selected" ? selected?.id ?? null : null,
    selectedJobTitle:
      input.mode === "selected" ? input.targetJobContext.selectedJobTitle : null,
    selectedJobCompany:
      input.mode === "selected" ? input.targetJobContext.selectedJobCompany : null,
    mode: input.mode,
  });

  // Final guard: Job Skill Gaps = technical only; Non-skill Requirements get the rest.
  const partitioned = partitionRequirements([
    ...overview.missingSkillsFromJobs,
    ...overview.experienceGaps,
    ...overview.evidenceGaps,
    ...overview.contextRequirements,
    ...extractedNonSkills,
  ]);
  const missingTechnicalSkills = partitioned.skill.filter(
    (skill) => isValidSkillName(skill) && isTechnicalSkillRequirement(skill),
  );
  const experienceGaps = partitioned.experience_gap;
  const evidenceGaps = partitioned.evidence_gap;
  const contextRequirements = partitioned.context_requirement;
  const prioritySkills = overview.prioritySkills
    .filter((item) => isTechnicalSkillRequirement(item.skill))
    .map((item) => {
      const effort = estimateLearningEffort(item.skill);
      return {
        ...item,
        estimatedEffort: effort.showHours ? effort.label : "",
        effortRationale: effort.rationale,
      };
    });

  return {
    selectedJob: input.mode === "selected" ? selected : null,
    coverageScore: overview.skillCoverageScore,
    matchedSkills: overview.matchedSkillsFromJobs,
    missingTechnicalSkills,
    experienceGaps,
    evidenceGaps,
    contextRequirements,
    prioritySkills,
    projectIdeas: overview.projectIdeas,
    recommendations: overview.recommendations,
    sourceLabel: overview.sourceLabel,
    overview: {
      ...overview,
      missingSkillsFromJobs: missingTechnicalSkills,
      experienceGaps,
      evidenceGaps,
      contextRequirements,
      prioritySkills,
      sourceLabel:
        input.mode === "selected"
          ? "Selected-job live guidance"
          : "AI strategy: all saved jobs",
    },
  };
}
