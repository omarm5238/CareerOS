export type ResumeTruthCode =
  | "NO_ACTIVE_RESUME"
  | "CURRENT_ANALYSIS_NOT_FOUND"
  | "STALE_RESUME_ANALYSIS"
  | "RESUME_REVISION_MISMATCH";

const MESSAGES: Record<ResumeTruthCode, string> = {
  NO_ACTIVE_RESUME: "A fresh resume analysis is required before CareerOS can use a current resume.",
  CURRENT_ANALYSIS_NOT_FOUND: "This resume has no current analysis. Analyze the full resume again.",
  STALE_RESUME_ANALYSIS: "This resume analysis is outdated. Reanalyze the current resume.",
  RESUME_REVISION_MISMATCH: "That resume revision does not belong to the active resume.",
};

export class ResumeTruthError extends Error {
  constructor(
    public code: ResumeTruthCode,
    message = MESSAGES[code],
  ) {
    super(message);
    this.name = "ResumeTruthError";
  }
}

export function toResumeTruthErrorResponse(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof ResumeTruthError)) return null;
  return { status: 409, message: error.message };
}
