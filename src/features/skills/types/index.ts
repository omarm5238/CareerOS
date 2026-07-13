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
