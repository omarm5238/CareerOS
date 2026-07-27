export {
  classifyInsightItem,
  filterActionItems,
  filterMarketSkillsOnly,
  filterResumeAdviceOutOfSkills,
  filterResumeFixItems,
  filterSkillLikeItems,
  isGenericCareerAdvice,
  isResumeImprovementPhrase,
  isValidMarketSkillName,
  isValidSkillName,
  normalizeInsightLabel,
  normalizeSkillName,
  stripResumeAdviceFromSkills,
} from "./taxonomy";
export {
  actionTitleFamilyFor,
  canonicalActionTitleKey,
  canonicalizeActionTitle,
} from "./action-title";

export type { ActionTitleFamily } from "./action-title";
export type { ClassifiedInsightItem, InsightItemType } from "./taxonomy";
export {
  classifyRequirement,
  partitionRequirements,
  isTechnicalSkillRequirement,
  toSpecRequirementKind,
} from "./classify-requirement";
export type {
  ClassifiedRequirement,
  RequirementKind,
  TechnicalRequirementKind,
} from "./classify-requirement";
export { estimateLearningEffort } from "./estimate-learning-effort";
export type { LearningEffort } from "./estimate-learning-effort";
export {
  buildSelectedTargetDelta,
} from "./build-selected-target-delta";
export type { SelectedTargetDeltaData } from "./build-selected-target-delta";
export {
  ZERO_JOBS_BENCHMARKING_MESSAGE,
  ZERO_JOBS_KEYWORD_MESSAGE,
  ZERO_JOBS_UNLOCK_MESSAGE,
} from "./zero-jobs-copy";
