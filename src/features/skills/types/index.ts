export type SkillCategory =
  | "Technical"
  | "Design"
  | "Tools"
  | "Soft Skills"
  | "Data"
  | "Other";

export type SkillPriority = "High" | "Medium" | "Low";

export type GroupedSkills = Record<SkillCategory, string[]>;

export type PrioritySkillItem = {
  id: string;
  skill: string;
  reason: string;
  demandSignal: string;
  priority: SkillPriority;
};

export type SkillsOverview = {
  detectedSkills: string[];
  groupedSkills: GroupedSkills;
  missingSkillsFromJobs: string[];
  missingSkillJobCounts: Record<string, number>;
  prioritySkills: PrioritySkillItem[];
  matchedSkillsFromJobs: string[];
  skillCoverageScore: number;
  recommendations: string[];
  savedJobsAnalyzedCount: number;
  categoryCount: number;
};

export type SkillsModuleData = {
  hasResume: boolean;
  resumeRole: string | null;
  resumeExperienceLevel: string | null;
  overview: SkillsOverview | null;
  insight: SkillsInsightView | null;
};

export type SkillsInsightSource = "ai" | "rule_based";

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

export type SkillsInsightView = {
  id: string;
  analysisSource: SkillsInsightSource;
  aiModel: string | null;
  skillCoverageScore: number;
  prioritySkills: SkillsInsightPrioritySkill[];
  learningRoadmap: SkillsInsightRoadmapItem[];
  projectIdeas: SkillsInsightProjectIdea[];
  resumeSkillAdvice: SkillsInsightResumeAdvice[];
  marketSignals: string[];
  warnings: string[];
  jobCount: number;
  generatedAt: string;
};

export type WorkspaceSkillsStatus = {
  detectedCount: number;
  gapCount: number;
  hasResume: boolean;
};

export type JobSkillsSnapshot = {
  id: string;
  title: string;
  matchedSkills: string[];
  missingSkills: string[];
  jobSignals: string[];
};
