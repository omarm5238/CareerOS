/**
 * Resume Versions — structured JSON shapes for Milestone 21+.
 *
 * These types describe content stored in resumeVersionRevision JSON columns.
 * They prepare the AI-safety surface (keyword coverage, warnings, evidence, snapshots)
 * without implementing the tailoring engine yet.
 */

export type ResumeVersionEvidenceStrength = "strong" | "medium" | "weak" | "none";

export type ResumeVersionKeywordType =
  | "technical_skill"
  | "tool"
  | "framework"
  | "domain"
  | "experience"
  | "soft_skill"
  | "certification"
  | "education"
  | "other";

export type ResumeVersionKeywordImportance = "high" | "medium" | "low";

export type ResumeVersionKeywordAction =
  | "use_safely"
  | "rephrase_existing_evidence"
  | "move_higher"
  | "add_to_project_evidence"
  | "keep_out_of_resume"
  | "add_to_roadmap";

export type ResumeVersionWarningType =
  | "missing_evidence"
  | "seniority_gap"
  | "keyword_missing"
  | "overclaim_risk"
  | "formatting_note"
  | "other";

export type ResumeVersionWarningSeverity = "low" | "medium" | "high";

export type ResumeVersionSkillCategory = {
  category: string;
  skills: string[];
};

export type ResumeVersionExperienceBullet = {
  source: string;
  original?: string;
  tailored: string;
  rationale?: string;
  evidenceStrength: ResumeVersionEvidenceStrength;
};

export type ResumeVersionContent = {
  summary: string;
  coreSkills: string[];
  technicalSkills: ResumeVersionSkillCategory[];
  experienceBullets: ResumeVersionExperienceBullet[];
  projects: ResumeVersionExperienceBullet[];
  education: string[];
  certifications: string[];
};

export type ResumeVersionKeywordCoverageItem = {
  keyword: string;
  type: ResumeVersionKeywordType;
  importance: ResumeVersionKeywordImportance;
  requiredByJob: boolean;
  presentInOriginalResume: boolean;
  usedInTailoredResume: boolean;
  evidenceStrength: ResumeVersionEvidenceStrength;
  action: ResumeVersionKeywordAction;
  note?: string;
};

export type ResumeVersionWarning = {
  type: ResumeVersionWarningType;
  severity: ResumeVersionWarningSeverity;
  message: string;
  recommendation?: string;
};

export type ResumeVersionChangeLogItem = {
  section: string;
  change: string;
  reason: string;
};

export type ResumeVersionEvidenceNote = {
  claim: string;
  evidence: string;
  strength: ResumeVersionEvidenceStrength;
  safeToUse: boolean;
};

export type ResumeVersionInputSnapshot = {
  resumeDocumentId?: string | null;
  resumeAnalysisId?: string | null;
  targetJobId?: string | null;
  targetJobAnalysisId?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  matchScore?: number | null;
  topSkillGaps?: string[];
  nonSkillBlockers?: string[];
};

export const RESUME_VERSION_EVIDENCE_STRENGTHS = [
  "strong",
  "medium",
  "weak",
  "none",
] as const satisfies readonly ResumeVersionEvidenceStrength[];

export const RESUME_VERSION_KEYWORD_ACTIONS = [
  "use_safely",
  "rephrase_existing_evidence",
  "move_higher",
  "add_to_project_evidence",
  "keep_out_of_resume",
  "add_to_roadmap",
] as const satisfies readonly ResumeVersionKeywordAction[];

export const EMPTY_RESUME_VERSION_CONTENT: ResumeVersionContent = {
  summary: "",
  coreSkills: [],
  technicalSkills: [],
  experienceBullets: [],
  projects: [],
  education: [],
  certifications: [],
};

export const EMPTY_RESUME_VERSION_INPUT_SNAPSHOT: ResumeVersionInputSnapshot = {
  resumeDocumentId: null,
  resumeAnalysisId: null,
  targetJobId: null,
  targetJobAnalysisId: null,
  jobTitle: null,
  company: null,
  matchScore: null,
  topSkillGaps: [],
  nonSkillBlockers: [],
};

/** Compact tailored-resume state shown inside the Jobs module. */
export type JobTailoredResumePrimary = {
  id: string;
  title: string;
  status: string;
  activeRevisionId: string | null;
  activeRevisionNumber: number | null;
  activeRevisionSource: string | null;
  alignmentScoreAfter: number | null;
  updatedAt: string;
};

export type JobTailoredResumeSummary = {
  primary: JobTailoredResumePrimary | null;
  archivedCount: number;
};

export type ResumeVersionListItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  targetJobId: string | null;
  targetJobTitle: string | null;
  targetJobCompany: string | null;
  activeRevisionId: string | null;
  activeRevisionNumber: number | null;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ResumeVersionRevisionSummary = {
  id: string;
  revisionNumber: number;
  source: string;
  generationStatus: string;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  model: string | null;
  aiSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeVersionDetail = {
  id: string;
  title: string;
  type: string;
  status: string;
  sourceResumeDocumentId: string | null;
  sourceResumeAnalysisId: string | null;
  sourceResumeFilename: string | null;
  targetJobId: string | null;
  targetJobAnalysisId: string | null;
  targetJobTitle: string | null;
  targetJobCompany: string | null;
  activeRevisionId: string | null;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  activeRevision: ResumeVersionRevisionDetail | null;
  revisions: ResumeVersionRevisionSummary[];
};

export type ResumeVersionRevisionDetail = {
  id: string;
  resumeVersionId: string;
  revisionNumber: number;
  source: string;
  generationStatus: string;
  content: ResumeVersionContent;
  keywordCoverage: ResumeVersionKeywordCoverageItem[];
  warnings: ResumeVersionWarning[];
  changeLog: ResumeVersionChangeLogItem[];
  evidenceNotes: ResumeVersionEvidenceNote[];
  inputSnapshot: ResumeVersionInputSnapshot;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  model: string | null;
  aiSource: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
