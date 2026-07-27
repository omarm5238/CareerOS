import type { TargetJobContext } from "@/features/jobs";

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
  estimatedEffort: string;
  effortRationale: string;
};

export type ContextualProjectIdea = {
  title: string;
  description: string;
  skillsProved: string[];
  outputArtifact: string;
  estimatedEffort: string;
  whyThisHelps: string;
};

export type SkillsOverview = {
  detectedSkills: string[];
  groupedSkills: GroupedSkills;
  missingSkillsFromJobs: string[];
  experienceGaps: string[];
  evidenceGaps: string[];
  contextRequirements: string[];
  missingSkillJobCounts: Record<string, number>;
  prioritySkills: PrioritySkillItem[];
  matchedSkillsFromJobs: string[];
  skillCoverageScore: number;
  recommendations: string[];
  projectIdeas: ContextualProjectIdea[];
  sourceLabel: string;
  savedJobsAnalyzedCount: number;
  categoryCount: number;
};

export type SkillsModuleData = {
  hasResume: boolean;
  resumeRole: string | null;
  resumeExperienceLevel: string | null;
  overview: SkillsOverview | null;
  insight: SkillsInsightView | null;
  targetJobContext: TargetJobContext;
  scopeMode: "selected_job" | "all_jobs";
};

export type SkillsInsightSource = "ai" | "rule_based";

export type SkillsEvidenceStatus =
  | "missing_from_resume"
  | "partially_supported"
  | "supported"
  | "needs_proof_first";

export type SkillsInsightPrioritySkill = {
  skill: string;
  priority: SkillPriority;
  reason: string;
  evidence: string;
  resumeSafe: boolean;
  evidenceStatus: SkillsEvidenceStatus;
  whyThisMatters: string;
  currentEvidence: string;
  learningTarget: string;
  proofProject: string;
  estimatedHours: string;
  resumeRule: string;
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
  description?: string;
  skillsCovered?: string[];
  output?: string;
  estimatedHours?: string;
  resumeProof?: string;
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
  isStale: boolean;
  staleReason: string | null;
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
