export { extractResumeText } from "./lib/extract-resume-text";
export { deleteResumeDocumentForUser } from "./lib/delete-resume-document-for-user";
export { getLatestResumeAnalysisForUser } from "./lib/get-latest-resume-analysis-for-user";
export { getResumeAnalysisByDocumentIdForUser } from "./lib/get-resume-analysis-by-document-id-for-user";
export { getResumeAnalysisHistoryForUser } from "./lib/get-resume-analysis-history-for-user";
export { saveResumeAnalysis } from "./lib/save-resume-analysis";

/** Milestone 21 — job-specific tailored resume versions. */
export {
  archiveResumeVersion,
  createResumeVersionForJob,
  createResumeVersionRevision,
  createResumeVersionShell,
  getJobTailoredResumeSummary,
  getResumeVersionDetailForUser,
  getResumeVersionForJob,
  getResumeVersionsForUser,
  regenerateResumeVersion,
  ResumeVersionAccessError,
  setActiveResumeVersionRevision,
  setResumeVersionStatus,
  toResumeVersionErrorResponse,
  updateResumeVersionContent,
} from "./versions";
