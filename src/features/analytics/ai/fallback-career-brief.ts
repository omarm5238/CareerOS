import type {
  CareerBriefAnalysisInput,
  CareerBriefResult,
} from "./types";
import { buildCareerExecutionPlan } from "../lib/build-career-execution-plan";
import { buildDeterministicActionCenter } from "../lib/build-deterministic-action-center";
import type { AnalyticsModuleData } from "../types";
import { canonicalActionTitleKey } from "@/features/shared/insights";

function toAnalyticsSnapshot(input: CareerBriefAnalysisInput): AnalyticsModuleData {
  const { resume, jobs, skills, analytics } = input;
  return {
    careerHealth: {
      score: analytics.healthScore,
      label: analytics.healthLabel as AnalyticsModuleData["careerHealth"]["label"],
      explanation: "",
    },
    resume: {
      hasResume: !!resume,
      latestRole: resume?.detectedRole ?? null,
      latestExperienceLevel: resume?.experienceLevel ?? null,
      completenessScore: resume?.completenessScore ?? null,
      resumeAnalysesCount: resume ? 1 : 0,
      detectedSkillsCount: resume?.detectedSkills.length ?? 0,
      analysisSource: null,
    },
    jobs: {
      savedJobsCount: jobs.count,
      averageMatchScore: jobs.averageMatchScore,
      bestMatchScore: jobs.bestMatchScore,
      weakestMatchScore: jobs.weakestMatchScore,
      strongMatchesCount: 0,
      partialMatchesCount: 0,
      weakMatchesCount: 0,
      aiAnalyzedCount: 0,
      ruleBasedAnalyzedCount: 0,
      savedStatusCount: jobs.savedStatusCount,
      appliedStatusCount: jobs.appliedStatusCount,
      interviewStatusCount: jobs.interviewStatusCount,
      offerStatusCount: jobs.offerStatusCount,
      rejectedStatusCount: jobs.rejectedStatusCount,
    },
    skills: {
      detectedSkillsCount: skills.detectedSkillsCount,
      skillCoverageScore: skills.skillCoverageScore,
      prioritySkillsCount: skills.prioritySkills.length,
      gapsCount: skills.topGaps.length,
      topPrioritySkills: skills.topGaps.length
        ? skills.topGaps
        : skills.prioritySkills.map((item) => item.skill),
      skillsInsightSource: skills.insightSource,
      skillsInsightGeneratedAt: null,
    },
    recommendations: [
      ...(resume?.weaknesses ?? []),
      ...(resume?.suggestedFocus ?? []),
      ...analytics.recommendations,
    ],
    hasUsableData: true,
    careerBrief: null,
    liveExecutionPlan: buildCareerExecutionPlan({
      hasResume: !!resume,
      resumeFixes: resume?.weaknesses ?? [],
      skillGaps: skills.topGaps,
      projectIdeas: skills.projectIdeas.map((item) => item.title),
      savedJobsCount: jobs.count,
      appliedCount: jobs.appliedStatusCount,
      selectedJobTitle: input.targetJob?.title,
      selectedJobCompany: input.targetJob?.company,
    }),
    targetJobContext: {
      savedJobsCount: jobs.count,
      selectedJobId: input.targetJob?.id ?? null,
      selectedJob: null,
      selectedJobTitle: input.targetJob?.title ?? null,
      selectedJobCompany: input.targetJob?.company ?? null,
      selectedJobCreatedAt: null,
      hasSelectedJob: !!input.targetJob,
      hasJobs: jobs.count > 0,
      mode: input.targetJob?.mode ?? (jobs.count > 0 ? "all_jobs" : "none"),
      availableJobs: [],
    },
    scopeMode: input.targetJob ? "selected_job" : "all_jobs",
    selectedTargetDelta: null,
  };
}

export function buildFallbackCareerBrief(
  input: CareerBriefAnalysisInput,
  options: { aiWarnings?: string[] } = {},
): CareerBriefResult {
  const { resume, jobs, skills, analytics } = input;
  const warnings = [...(options.aiWarnings ?? [])];

  if (!resume) {
    warnings.push("Analyze a resume first for a stronger CareerOS Brief.");
  }

  if (jobs.count === 0) {
    warnings.push(
      "No saved jobs yet. Add a target job to compare your resume against real requirements.",
    );
  }

  const topRisks = [];
  if (!resume) {
    topRisks.push({
      title: "No resume baseline",
      reason: "Without a resume analysis, match and skills guidance stay incomplete.",
      severity: "High" as const,
    });
  } else if (resume.completenessScore < 70) {
    topRisks.push({
      title: "Resume completeness is low",
      reason: `Completeness is ${resume.completenessScore}%. Gaps reduce match quality.`,
      severity: "High" as const,
    });
  }
  if (skills.topGaps.length > 0) {
    topRisks.push({
      title: "Market skill gaps remain open",
      reason: `Top gaps: ${skills.topGaps.slice(0, 3).join(", ")}.`,
      severity: "High" as const,
    });
  }
  if (jobs.count === 0) {
    topRisks.push({
      title: "Save one target job",
      reason: "Add one target job to unlock market benchmarking.",
      severity: "High" as const,
    });
  }

  const topOpportunities = [];
  if (skills.prioritySkills[0]) {
    topOpportunities.push({
      title: `Prioritize ${skills.prioritySkills[0].skill}`,
      reason: skills.prioritySkills[0].reason ?? "High-impact skill from your strategy.",
      impact: "High" as const,
    });
  }
  if (skills.projectIdeas[0]) {
    topOpportunities.push({
      title: skills.projectIdeas[0].title,
      reason: skills.projectIdeas[0].proof,
      impact: "Medium" as const,
    });
  }
  if ((jobs.bestMatchScore ?? 0) >= 70) {
    topOpportunities.push({
      title: "Strong match already exists",
      reason: `Best match score is ${jobs.bestMatchScore}%.`,
      impact: "Medium" as const,
    });
  }

  const nextActions = [];
  if (!resume) {
    nextActions.push({
      title: "Analyze a resume",
      category: "Resume" as const,
      priority: "High" as const,
      reason: "Everything else depends on a resume baseline.",
    });
  }
  if (jobs.count === 0) {
    nextActions.push({
      title: "Save one target job",
      category: "Jobs" as const,
      priority: "High" as const,
      reason: "Keyword benchmarking requires at least one saved job.",
    });
  }
  if (skills.topGaps[0]) {
    nextActions.push({
      title: `Build proof for ${skills.topGaps[0]}`,
      category: "Skills" as const,
      priority: "High" as const,
      reason: "Close the highest market gap with a concrete project.",
    });
  }
  if (jobs.savedStatusCount > 0) {
    nextActions.push({
      title: "Advance one saved job to applied",
      category: "Applications" as const,
      priority: "Medium" as const,
      reason: "Convert research into application progress on the strongest fit.",
    });
  }
  for (const tip of analytics.recommendations.slice(0, 2)) {
    nextActions.push({
      title: tip.slice(0, 120),
      category: "Resume" as const,
      priority: "Medium" as const,
      reason: "From your current deterministic analytics recommendations.",
    });
  }

  const careerExecutionPlan = buildCareerExecutionPlan({
    hasResume: !!resume,
    resumeFixes: [
      ...(resume?.weaknesses ?? []),
      ...(resume?.suggestedFocus ?? []),
      ...analytics.recommendations,
    ].slice(0, 6),
    skillGaps: skills.topGaps.slice(0, 4),
    projectIdeas: skills.projectIdeas.map((item) => item.title).slice(0, 3),
    savedJobsCount: jobs.count,
    appliedCount: jobs.appliedStatusCount,
    selectedJobTitle: input.targetJob?.title,
    selectedJobCompany: input.targetJob?.company,
  });

  const thirtyDayPlan = careerExecutionPlan.weeks.map((week) => ({
    week: week.week,
    focus: week.focus,
    outcome: week.outcome,
  }));

  const roleLabel = resume?.detectedRole ?? "your target role";
  const headline = resume
    ? `${roleLabel} profile is ${analytics.healthLabel.toLowerCase()} at ${analytics.healthScore}% readiness`
    : "Add a resume to unlock a full CareerOS Brief";

  const summaryParts = [
    `Career health is ${analytics.healthScore} (${analytics.healthLabel}).`,
  ];
  if (resume) {
    summaryParts.push(
      `Resume completeness is ${resume.completenessScore}% with ${resume.detectedSkills.length} detected skills.`,
    );
  }
  if (jobs.count > 0) {
    summaryParts.push(
      `${jobs.count} saved job(s); average match ${jobs.averageMatchScore ?? "n/a"}%.`,
    );
  }
  if (skills.topGaps.length > 0) {
    summaryParts.push(`Top skill gaps: ${skills.topGaps.slice(0, 3).join(", ")}.`);
  }
  const executiveActions = nextActions.slice(0, 3);
  const executiveKeys = new Set(
    executiveActions.map((item) => canonicalActionTitleKey(item.title)),
  );
  const actionCenter = buildDeterministicActionCenter(
    toAnalyticsSnapshot(input),
  )
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !executiveKeys.has(canonicalActionTitleKey(item.title)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return {
    healthScore: analytics.healthScore,
    headline: headline.slice(0, 140),
    summary: summaryParts.join(" ").slice(0, 900),
    topRisks: topRisks.slice(0, 3),
    topOpportunities: topOpportunities.slice(0, 5),
    nextActions: executiveActions,
    thirtyDayPlan: thirtyDayPlan.slice(0, 4),
    careerExecutionPlan,
    actionCenter,
    warnings: warnings.slice(0, 5),
    dataSourceNotes: [
      "Generated from the latest resume snapshot and selected target-job context.",
    ],
    analysisSource: "rule_based",
    aiModel: null,
  };
}
