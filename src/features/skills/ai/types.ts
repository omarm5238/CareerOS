import type { SkillPriority, SkillsOverview } from "../types";

export type SkillsInsightSource = "ai" | "rule_based";

export type SkillsResumeInput = {
  detectedRole: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkills: string[];
  profileSummary: string | null;
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string[];
  atsRecommendations: string[];
};

export type SkillsJobAnalysisInput = {
  title: string;
  company: string;
  matchScore: number;
  roleAlignment: string;
  matchedSkills: string[];
  missingSkills: string[];
  jobSignals: string[];
  fitSummary: string | null;
  resumeTailoringTips: string[];
};

export type SkillsInsightAnalysisInput = {
  resume: SkillsResumeInput;
  jobs: SkillsJobAnalysisInput[];
  overview: SkillsOverview;
};

export type SkillsInsightPrioritySkill = {
  skill: string;
  priority: SkillPriority;
  reason: string;
  evidence: string;
  resumeSafe: boolean;
};

export type SkillsInsightRoadmapItem = {
  title: string;
  skills: string[];
  timeframe: string;
  outcome: string;
};

export type SkillsInsightProjectIdea = {
  title: string;
  skills: string[];
  proof: string;
};

export type SkillsInsightResumeAdvice = {
  skill: string;
  advice: string;
  action: "Add evidence first" | "Add to resume" | "Do not add yet";
};

export type SkillsInsightResult = {
  skillCoverageScore: number;
  prioritySkills: SkillsInsightPrioritySkill[];
  learningRoadmap: SkillsInsightRoadmapItem[];
  projectIdeas: SkillsInsightProjectIdea[];
  resumeSkillAdvice: SkillsInsightResumeAdvice[];
  marketSignals: string[];
  warnings: string[];
  analysisSource: SkillsInsightSource;
  aiModel?: string | null;
};

export type SkillsInsightAIPayload = {
  skillCoverageScore?: unknown;
  prioritySkills?: unknown;
  learningRoadmap?: unknown;
  projectIdeas?: unknown;
  resumeSkillAdvice?: unknown;
  marketSignals?: unknown;
  warnings?: unknown;
};
