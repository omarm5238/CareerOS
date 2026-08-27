import type {
  ResumeVersionChangeLogItem,
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionInputSnapshot,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionWarning,
} from "../types";

export type ResumeTailoringResumeInput = {
  resumeDocumentId: string;
  resumeAnalysisId: string | null;
  filename: string;
  textPreview: string;
  textPreviewTruncated: boolean;
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

export type ResumeTailoringJobInput = {
  jobId: string;
  jobAnalysisId: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string;
  descriptionTruncated: boolean;
  matchScore: number | null;
  roleAlignment: string | null;
  matchedSkills: string[];
  missingSkills: string[];
  nonSkillBlockers: string[];
  resumeTailoringTips: string[];
  applicationStrategy: string[];
};

export type ResumeTailoringInput = {
  userId: string;
  resume: ResumeTailoringResumeInput;
  job: ResumeTailoringJobInput;
};

/** Raw, untrusted AI payload before sanitization. */
export type ResumeTailoringAIPayload = Record<string, unknown>;

export type ResumeTailoringSource = "ai" | "rule_based";

export type ResumeTailoringResult = {
  tailoredTitle: string;
  content: ResumeVersionContent;
  keywordCoverage: ResumeVersionKeywordCoverageItem[];
  warnings: ResumeVersionWarning[];
  changeLog: ResumeVersionChangeLogItem[];
  evidenceNotes: ResumeVersionEvidenceNote[];
  inputSnapshot: ResumeVersionInputSnapshot;
  alignmentScoreBefore: number;
  alignmentScoreAfter: number;
  aiSource: ResumeTailoringSource;
  model: string | null;
};
