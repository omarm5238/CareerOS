import type { JobMatchAnalysis } from "../types";

export function jobMatchAnalysisToPrismaData(analysis: JobMatchAnalysis) {
  return {
    matchScore: analysis.matchScore,
    roleAlignment: analysis.roleAlignment,
    matchedSkills: analysis.matchedSkills,
    missingSkills: analysis.missingSkills,
    resumeSignals: analysis.resumeSignals,
    jobSignals: analysis.jobSignals,
    recommendations: analysis.recommendations,
    analysisSource: analysis.analysisSource,
    aiModel: analysis.aiModel ?? null,
    fitSummary: analysis.fitSummary ?? null,
    applicationStrategy: analysis.applicationStrategy,
    resumeTailoringTips: analysis.resumeTailoringTips,
    aiWarnings: analysis.aiWarnings,
  };
}
