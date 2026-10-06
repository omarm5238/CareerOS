import { prisma } from "@/server/db/prisma";
import { ResumeTruthError } from "@/features/resume/provenance";

import { getOpportunityAnalysisForUser } from "./analyze-job-opportunity";
import { getCurrentOpportunityAnalysis } from "../provenance/current-opportunity";
import { canonicalResumeSkillName } from "@/features/resume/provenance/normalize-resume-skills";
import { classifyEvidenceResult } from "../provenance/semantic-evidence";

export async function getOpportunitySummaryForJob(userId: string, jobPostingId: string) {
  const analysis = await getOpportunityAnalysisForUser(userId, jobPostingId);
  if (!analysis) return null;
  const requirements = await prisma.jobRequirement.findMany({
    where: { userId, jobPostingId },
    include: { evidenceMatches: true },
    take: 8,
  });
  let provenance: {
    state: "current" | "stale" | "missing";
    filename: string | null;
    revisionNumber: number | null;
    analyzedAt: string | null;
  } = { state: "missing", filename: null, revisionNumber: null, analyzedAt: null };
  try {
    const current = await getCurrentOpportunityAnalysis({ userId, jobPostingId });
    if (current) {
      const revision = await prisma.resumeSourceRevision.findUnique({
        where: { id: current.resumeRevisionId },
        select: { sourceFilename: true, revisionNumber: true },
      });
      provenance = {
        state: "current",
        filename: revision?.sourceFilename ?? null,
        revisionNumber: revision?.revisionNumber ?? null,
        analyzedAt: current.createdAt.toISOString(),
      };
    } else {
      provenance = { ...provenance, state: "stale" };
    }
  } catch (error) {
    if (!(error instanceof ResumeTruthError)) throw error;
    provenance = { ...provenance, state: "missing" };
  }
  const evidenceRows = requirements.map((row) => {
    const result = classifyEvidenceResult({
      requirement: row,
      matches: row.evidenceMatches.map((match) => ({
        matchStrength: match.matchStrength,
        evidenceType: match.evidenceType,
        verified: match.verified,
      })),
    });
    const supporting = row.evidenceMatches.find((match) => match.verified && match.matchStrength !== "NONE");
    return {
      requirement: row.normalizedName,
      result,
      evidence: canonicalResumeSkillName(supporting?.evidenceLabel ?? "") ?? supporting?.evidenceLabel ?? "No verified evidence",
      gap: result === "MATCHED" ? "Supported by the active resume" : supporting?.reasoning ?? "No verified evidence on the active resume",
    };
  });
  return {
    ...analysis,
    provenance,
    evidenceRows,
    topEvidence: requirements
      .flatMap((row) => row.evidenceMatches)
      .filter((match) => match.verified && (match.matchStrength === "DIRECT" || match.matchStrength === "STRONG"))
      .slice(0, 3)
      .map((match) => canonicalResumeSkillName(match.evidenceLabel) ?? match.evidenceLabel),
    topGaps: analysis.gaps.filter((gap) => gap.severity === "IMPORTANT" || gap.severity === "CRITICAL").slice(0, 3),
  };
}
