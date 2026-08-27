import {
  generateJsonWithAI,
  getAiConfig,
  logAiAttempt,
  type AiDiagnostic,
} from "@/server/ai";

import { buildResumeVersionInputSnapshot } from "./build-resume-tailoring-input";
import {
  isValidResumeTailoring,
  sanitizeResumeTailoringOutput,
} from "./parse-resume-tailoring-output";
import {
  buildResumeTailoringRetryPrompt,
  buildResumeTailoringUserPrompt,
  RESUME_TAILORING_SYSTEM_PROMPT,
} from "./resume-tailoring-prompt";
import type {
  ResumeTailoringAIPayload,
  ResumeTailoringInput,
  ResumeTailoringResult,
} from "./types";

export type TailorResumeForJobWithAiResult =
  | { success: true; result: ResumeTailoringResult }
  | { success: false; diagnostic: AiDiagnostic };

function envTimeout(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(60_000, Math.max(5_000, value));
}

export async function tailorResumeForJobWithAi(
  input: ResumeTailoringInput,
): Promise<TailorResumeForJobWithAiResult> {
  const config = getAiConfig();
  const primaryModel =
    process.env.OPENAI_RESUME_TAILORING_MODEL?.trim() ||
    process.env.OPENAI_ANALYTICS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    config.model;
  const retryModel =
    process.env.OPENAI_RESUME_TAILORING_FAST_MODEL?.trim() || primaryModel;

  const fallbackAlignmentBefore = input.job.matchScore ?? 40;

  const attempts = [
    {
      attempt: 1,
      model: primaryModel,
      timeoutMs: envTimeout("OPENAI_RESUME_TAILORING_TIMEOUT_MS", 55_000),
      prompt: buildResumeTailoringUserPrompt(input),
    },
    {
      attempt: 2,
      model: retryModel,
      timeoutMs: envTimeout("OPENAI_RESUME_TAILORING_RETRY_TIMEOUT_MS", 35_000),
      prompt: buildResumeTailoringRetryPrompt(input),
    },
  ];

  let lastDiagnostic: AiDiagnostic = {
    hasApiKey: config.hasApiKey,
    model: primaryModel,
    reason: "ai_unavailable",
  };

  for (const attempt of attempts) {
    const attemptTaskName = `resume-tailoring-attempt-${attempt.attempt}`;

    const aiResult = await generateJsonWithAI<ResumeTailoringAIPayload>({
      taskName: attemptTaskName,
      systemPrompt: RESUME_TAILORING_SYSTEM_PROMPT,
      userPrompt: attempt.prompt,
      fallbackLabel: "resume-tailoring",
      model: attempt.model,
      timeoutMs: attempt.timeoutMs,
      temperature: 0.2,
    });

    if (!aiResult.ok) {
      lastDiagnostic = aiResult.diagnostic;
      logAiAttempt(attemptTaskName, attempt.attempt, aiResult.diagnostic);
      continue;
    }

    const sanitized = sanitizeResumeTailoringOutput(aiResult.data, {
      fallbackAlignmentBefore,
    });

    if (!isValidResumeTailoring(sanitized) || !sanitized) {
      lastDiagnostic = {
        hasApiKey: config.hasApiKey,
        model: aiResult.model,
        reason: "json_validation_failed",
        jsonValidationFailed: true,
      };
      logAiAttempt(attemptTaskName, attempt.attempt, lastDiagnostic);
      continue;
    }

    const warnings = [...sanitized.warnings];
    if (input.resume.textPreviewTruncated || input.job.descriptionTruncated) {
      warnings.unshift({
        type: "formatting_note",
        severity: "low",
        message:
          "Long source text was capped before tailoring, so some detail may be missing.",
        recommendation: "Review each section before using this version.",
      });
    }

    return {
      success: true,
      result: {
        tailoredTitle:
          sanitized.tailoredTitle || `${input.job.title} — ${input.job.company}`,
        content: sanitized.content,
        keywordCoverage: sanitized.keywordCoverage,
        warnings: warnings.slice(0, 12),
        changeLog: sanitized.changeLog,
        evidenceNotes: sanitized.evidenceNotes,
        inputSnapshot: buildResumeVersionInputSnapshot(input),
        alignmentScoreBefore: sanitized.alignmentScoreBefore,
        alignmentScoreAfter: sanitized.alignmentScoreAfter,
        aiSource: "ai",
        model: aiResult.model,
      },
    };
  }

  return { success: false, diagnostic: lastDiagnostic };
}
