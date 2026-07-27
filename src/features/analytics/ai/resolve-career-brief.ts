import { isAiConfigured, logAiFallback } from "@/server/ai";
import { canonicalActionTitleKey } from "@/features/shared/insights";

import { buildCareerExecutionPlan } from "../lib/build-career-execution-plan";
import { sanitizeActionCenterSections } from "../lib/build-deterministic-action-center";
import { analyzeCareerBriefWithAi } from "./analyze-career-brief-with-ai";
import { buildFallbackCareerBrief } from "./fallback-career-brief";
import type {
  CareerBriefActionCenterSection,
  CareerBriefAnalysisInput,
  CareerBriefResult,
} from "./types";

function ensureActionCenterForInput(
  input: CareerBriefAnalysisInput,
  sections: CareerBriefActionCenterSection[],
): CareerBriefActionCenterSection[] {
  if (input.jobs.count > 0) return sanitizeActionCenterSections(sections);

  const safeSections = sections.filter(
    (section) => section.section !== "Skill Proof Needed",
  );
  safeSections.push({
    section: "Job Actions",
    items: [
      {
        title: "Save one target job",
        reason: "Add one target job to unlock market benchmarking.",
        priority: "High",
      },
    ],
  });

  const resumeItems = input.resume?.resumeImprovementItems.slice(0, 2) ?? [];
  if (resumeItems.length > 0) {
    safeSections.push({
      section: "Resume Fixes",
      items: resumeItems.map((item) => ({
        title: item.title,
        reason: item.reason,
        priority:
          item.priority.toLowerCase() === "high"
            ? "High"
            : item.priority.toLowerCase() === "low"
              ? "Low"
              : "Medium",
      })),
    });
  }

  if (input.resume) {
    safeSections.push({
      section: "Portfolio Proof",
      items: [
        {
          title: "Add GitHub or portfolio links for strongest project",
          reason: "Add links only when they point to real work you can explain.",
          priority: "Medium",
        },
      ],
    });
  }

  return sanitizeActionCenterSections(safeSections);
}

function ensureExecutionPlan(
  input: CareerBriefAnalysisInput,
  result: CareerBriefResult,
): CareerBriefResult {
  const careerExecutionPlan = buildCareerExecutionPlan({
    hasResume: !!input.resume,
    resumeFixes: [
      ...(input.resume?.weaknesses ?? []),
      ...(input.resume?.suggestedFocus ?? []),
      ...input.analytics.recommendations,
    ].slice(0, 6),
    skillGaps: input.skills.topGaps.slice(0, 4),
    projectIdeas: input.skills.projectIdeas.map((item) => item.title).slice(0, 3),
    savedJobsCount: input.jobs.count,
    appliedCount: input.jobs.appliedStatusCount,
    selectedJobTitle: input.targetJob?.title,
    selectedJobCompany: input.targetJob?.company,
  });

  const finalized = {
    ...careerExecutionPlan,
  };
  const nextActionKeys = new Set(
    result.nextActions
      .slice(0, 3)
      .map((item) => canonicalActionTitleKey(item.title)),
  );
  const actionCenter = ensureActionCenterForInput(
    input,
    result.actionCenter,
  )
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !nextActionKeys.has(canonicalActionTitleKey(item.title)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return {
    ...result,
    careerExecutionPlan: finalized,
    thirtyDayPlan: finalized.weeks.map((week) => ({
      week: week.week,
      focus: week.focus,
      outcome: week.outcome,
    })),
    nextActions: result.nextActions.slice(0, 3),
    topRisks: result.topRisks.slice(0, 3),
    actionCenter,
  };
}

export async function resolveCareerBrief(
  input: CareerBriefAnalysisInput,
): Promise<CareerBriefResult> {
  if (!isAiConfigured() || !input.resume) {
    return buildFallbackCareerBrief(input, {
      aiWarnings: !input.resume
        ? ["Analyze a resume first for a stronger CareerOS Brief."]
        : [
            "This is a provisional rule-based brief. Retry with AI for deeper analysis.",
          ],
    });
  }

  const aiOutcome = await analyzeCareerBriefWithAi(input);

  if (aiOutcome.success) {
    return ensureExecutionPlan(input, aiOutcome.analysis);
  }

  logAiFallback("career-brief", aiOutcome.diagnostic);

  return buildFallbackCareerBrief(input, {
    aiWarnings: [
      "This is a provisional rule-based brief. Retry with AI for deeper analysis.",
    ],
  });
}

export { isAiConfigured };
