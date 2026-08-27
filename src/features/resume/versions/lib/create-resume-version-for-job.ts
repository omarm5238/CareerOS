import { prisma } from "@/server/db/prisma";

import { buildResumeTailoringInput } from "../ai/build-resume-tailoring-input";
import { resolveResumeTailoring } from "../ai/resolve-resume-tailoring";
import type { ResumeTailoringSource } from "../ai/types";
import { createResumeVersionRevision } from "./create-resume-version-revision";
import { createResumeVersionShell } from "./create-resume-version-shell";

export type CreateResumeVersionForJobInput = {
  userId: string;
  targetJobId: string;
  sourceResumeDocumentId?: string | null;
};

export type CreateResumeVersionForJobResult =
  | {
      ok: true;
      versionId: string;
      revisionId: string;
      source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
      aiSource: ResumeTailoringSource;
      status: "DRAFT";
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

export async function createResumeVersionForJob(
  input: CreateResumeVersionForJobInput,
): Promise<CreateResumeVersionForJobResult> {
  const job = await prisma.jobPosting.findFirst({
    where: { id: input.targetJobId, userId: input.userId },
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
  });

  if (!job) {
    return { ok: false, status: 404, message: "Job not found." };
  }

  const resumeDocument = input.sourceResumeDocumentId
    ? await prisma.resumeDocument.findFirst({
        where: { id: input.sourceResumeDocumentId, userId: input.userId },
        select: RESUME_DOCUMENT_SELECT,
      })
    : await prisma.resumeDocument.findFirst({
        where: { userId: input.userId, analysis: { isNot: null } },
        orderBy: { createdAt: "desc" },
        select: RESUME_DOCUMENT_SELECT,
      });

  if (!resumeDocument) {
    return {
      ok: false,
      status: 400,
      message: input.sourceResumeDocumentId
        ? "That resume could not be found in your account."
        : "Upload and analyze a resume before creating a tailored version.",
    };
  }

  if (!resumeDocument.analysis) {
    return {
      ok: false,
      status: 400,
      message: "This resume has no analysis yet. Analyze it before tailoring.",
    };
  }

  const tailoringInput = buildResumeTailoringInput({
    userId: input.userId,
    resumeDocument,
    job,
  });

  // Tailoring runs before any write so a failure cannot leave an empty version behind.
  const tailoring = await resolveResumeTailoring(tailoringInput);

  const version = await createResumeVersionShell({
    userId: input.userId,
    title: tailoring.tailoredTitle || `${job.title} — ${job.company}`,
    type: "JOB_SPECIFIC",
    sourceResumeDocumentId: resumeDocument.id,
    sourceResumeAnalysisId: resumeDocument.analysis.id,
    targetJobId: job.id,
    targetJobAnalysisId: job.analysis?.id ?? null,
    alignmentScoreBefore: tailoring.alignmentScoreBefore,
    alignmentScoreAfter: tailoring.alignmentScoreAfter,
  });

  const source = tailoring.aiSource === "ai" ? "AI_GENERATED" : "RULE_BASED_FALLBACK";

  try {
    const revision = await createResumeVersionRevision({
      userId: input.userId,
      resumeVersionId: version.id,
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

    return {
      ok: true,
      versionId: version.id,
      revisionId: revision.id,
      source,
      aiSource: tailoring.aiSource,
      status: "DRAFT",
      message:
        tailoring.aiSource === "ai"
          ? "Tailored resume draft created with AI."
          : "AI was unavailable. A rule-based tailored draft was created.",
    };
  } catch (error) {
    // Never leave a version without an active revision.
    await prisma.resumeVersion.delete({ where: { id: version.id } }).catch(() => null);
    throw error;
  }
}
