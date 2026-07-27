export type {
  CareerBriefActionCenterSection,
  CareerBriefActionCategory,
  CareerBriefActionItem,
  CareerBriefActionSection,
  CareerBriefAnalysisInput,
  CareerBriefNextAction,
  CareerBriefOpportunity,
  CareerBriefPlanItem,
  CareerBriefResult,
  CareerBriefRisk,
  CareerBriefSource,
} from "./types";

export { resolveCareerBrief, isAiConfigured } from "./resolve-career-brief";
export { buildFallbackCareerBrief } from "./fallback-career-brief";
