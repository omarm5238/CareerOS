import { prisma } from "@/server/db/prisma";

import { buildResumeTailoringInput } from "../ai/build-resume-tailoring-input";
import { resolveResumeTailoring } from "../ai/resolve-resume-tailoring";
import type { ResumeTailoringSource } from "../ai/types";
import { createResumeVersionRevision } from "./create-resume-version-revision";
import { assertResumeVersionOwnedByUser } from "./resume-version-permissions";

export type RegenerateResumeVersionResult =
  | {
      ok: true;
      revisionId: string;
      revisionNumber: number;
      source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
      aiSource: ResumeTailoringSource;
      message: string;
    }
  | { ok: false; status: number; message: string };

const RESUME_DOCUMENT_SELECT = {
  id: true,
  filename: true,
  textPreview: true,
  analysis: {
    select: {
      id: true,
      detectedRole: true,
      experienceLevel: true,
      completenessScore: true,
      detectedSkills: true,
      suggestedFocus: true,
      profileSummary: true,
      strengths: true,
      weaknesses: true,
      atsRecommendations: true,
    },
  },
} as const;

export async function regenerateResumeVersion(
  userId: string,
  versionId: string,
): Promise<RegenerateResumeVersionResult> {
  await assertResumeVersionOwnedByUser(userId, versionId);

  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: {
      id: true,
      title: true,
      sourceResumeDocumentId: true,
      targetJob: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          description: true,
          analysis: {
            select: {
              id: true,
              matchScore: true,
              roleAlignment: true,
              matchedSkills: true,
              missingSkills: true,
              applicationStrategy: true,
              resumeTailoringTips: true,
            },
          },
        },
      },
    },
  });

  if (!version) {
    return { ok: false, status: 404, message: "Resume version not found." };
  }

  if (!version.targetJob) {
    return {
      ok: false,
      status: 400,
      message:
        "The target job for this version no longer exists, so it cannot be regenerated. Existing revisions are unchanged.",
    };
  }

  // Falls back to the newest analyzed resume when the original document was removed.
  const resumeDocument = version.sourceResumeDocumentId
    ? await prisma.resumeDocument.findFirst({
        where: { id: version.sourceResumeDocumentId, userId },
        select: RESUME_DOCUMENT_SELECT,
      })
    : null;

  const effectiveDocument =
    resumeDocument ??
    (await prisma.resumeDocument.findFirst({
      where: { userId, analysis: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: RESUME_DOCUMENT_SELECT,
    }));

  if (!effectiveDocument?.analysis) {
    return {
      ok: false,
      status: 400,
      message:
        "No analyzed resume is available to regenerate from. Existing revisions are unchanged.",
    };
  }

  const tailoringInput = buildResumeTailoringInput({
    userId,
    resumeDocument: effectiveDocument,
    job: version.targetJob,
  });

  const tailoring = await resolveResumeTailoring(tailoringInput);
  const source = tailoring.aiSource === "ai" ? "AI_GENERATED" : "RULE_BASED_FALLBACK";

  const revision = await createResumeVersionRevision({
    userId,
    resumeVersionId: versionId,
    source,
    content: tailoring.content,
    keywordCoverage: tailoring.keywordCoverage,
    warnings: tailoring.warnings,
    changeLog: tailoring.changeLog,
    evidenceNotes: tailoring.evidenceNotes,
    inputSnapshot: tailoring.inputSnapshot,
    alignmentScoreBefore: tailoring.alignmentScoreBefore,
    alignmentScoreAfter: tailoring.alignmentScoreAfter,
    model: tailoring.model,
    aiSource: tailoring.aiSource,
    generationStatus: "COMPLETED",
    setAsActive: true,
  });

  await prisma.resumeVersion.update({
    where: { id: versionId },
    data: {
      sourceResumeDocumentId: effectiveDocument.id,
      sourceResumeAnalysisId: effectiveDocument.analysis.id,
      targetJobAnalysisId: version.targetJob.analysis?.id ?? null,
    },
  });

  return {
    ok: true,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    source,
    aiSource: tailoring.aiSource,
    message:
      tailoring.aiSource === "ai"
        ? "New AI revision created. Previous revisions are preserved."
        : "AI was unavailable. A rule-based revision was created. Previous revisions are preserved.",
  };
}
