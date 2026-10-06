export type OpportunityTruthCode =
  | "NO_ACTIVE_RESUME"
  | "CURRENT_ANALYSIS_NOT_FOUND"
  | "STALE_OPPORTUNITY_ANALYSIS"
  | "CURRENT_OPPORTUNITY_ANALYSIS_NOT_FOUND"
  | "RESUME_REVISION_MISMATCH"
  | "EVIDENCE_NOT_FOUND";

const MESSAGES: Record<OpportunityTruthCode, string> = {
  NO_ACTIVE_RESUME: "A fresh resume analysis is required before CareerOS can analyze this job.",
  CURRENT_ANALYSIS_NOT_FOUND: "The current resume has no analysis. Analyze the resume again before this job.",
  STALE_OPPORTUNITY_ANALYSIS: "Resume or job changed since this analysis. Re-run opportunity analysis before preparing an application.",
  CURRENT_OPPORTUNITY_ANALYSIS_NOT_FOUND: "Opportunity analysis is required before preparing an application.",
  RESUME_REVISION_MISMATCH: "This opportunity analysis used a different resume than the active one.",
  EVIDENCE_NOT_FOUND: "No verified evidence is available for this requirement.",
};

export class OpportunityTruthError extends Error {
  constructor(
    public code: OpportunityTruthCode,
    message = MESSAGES[code],
  ) {
    super(message);
    this.name = "OpportunityTruthError";
  }
}

export function toOpportunityTruthErrorResponse(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof OpportunityTruthError)) return null;
  return { status: 409, message: error.message };
}
