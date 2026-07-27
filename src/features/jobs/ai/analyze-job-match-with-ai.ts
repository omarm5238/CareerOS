import {
  generateJsonWithAI,
  getAiConfig,
  logAiAttempt,
  type AiDiagnostic,
} from "@/server/ai";
import { analyzeJobMatchRuleBased } from "../lib/analyze-job-match-rule-based";

import { limitJobDescriptionForAi } from "./limit-job-text-for-ai";
import {
  isValidJobMatchAIAnalysis,
  sanitizeJobMatchAIAnalysis,
} from "./job-match-schema";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchRetryPrompt,
  buildJobMatchUserPrompt,
} from "./prompts";
import type {
  JobMatchAIAnalysisPayload,
  JobMatchAnalysisInput,
  JobMatchAnalysisResult,
} from "./types";

export type AnalyzeJobMatchWithAiResult =
  | { success: true; analysis: JobMatchAnalysisResult }
  | { success: false; diagnostic: AiDiagnostic };

function envTimeout(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(60_000, Math.max(5_000, value));
}

export async function analyzeJobMatchWithAi(
  input: JobMatchAnalysisInput,
): Promise<AnalyzeJobMatchWithAiResult> {
  if (!input.resume) {
    return {
      success: false,
      diagnostic: {
        hasApiKey: false,
        model: "",
        reason: "missing_resume_profile",
      },
    };
  }

  const { text: limitedDescription, truncated } = limitJobDescriptionForAi(
    input.job.description,
    3_200,
  );

  const config = getAiConfig();
  const primaryModel =
    process.env.OPENAI_JOB_MATCH_MODEL?.trim() ||
    process.env.OPENAI_ANALYTICS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    config.model;
  const retryModel =
    process.env.OPENAI_JOB_MATCH_FAST_MODEL?.trim() || primaryModel;
  const hints = analyzeJobMatchRuleBased({
    title: input.job.title,
    description: input.job.description,
    resume: {
      role: input.resume.detectedRole,
      experienceLevel: input.resume.experienceLevel,
      detectedSkills: input.resume.detectedSkills,
    },
  });
  const attempts = [
    {
      attempt: 1,
      model: primaryModel,
      timeoutMs: envTimeout("OPENAI_JOB_MATCH_TIMEOUT_MS", 45_000),
      prompt: buildJobMatchUserPrompt({
        resume: input.resume,
        job: {
          ...input.job,
          description: limitedDescription,
          descriptionTruncated: truncated,
        },
      }),
    },
    {
      attempt: 2,
      model: retryModel,
      timeoutMs: envTimeout("OPENAI_JOB_MATCH_RETRY_TIMEOUT_MS", 30_000),
      prompt: buildJobMatchRetryPrompt({
        resume: input.resume,
        job: {
          title: input.job.title,
          company: input.job.company,
          location: input.job.location,
          description: limitedDescription,
        },
        hints: {
          matchedSkills: hints.matchedSkills.slice(0, 12),
          missingSkills: hints.missingSkills.slice(0, 12),
        },
      }),
    },
  ];
  let lastDiagnostic: AiDiagnostic = {
    hasApiKey: config.hasApiKey,
    model: primaryModel,
    reason: "ai_unavailable",
  };

  for (const attempt of attempts) {
    const attemptTaskName = `job-match-attempt-${attempt.attempt}`;
    const aiResult = await generateJsonWithAI<JobMatchAIAnalysisPayload>({
      taskName: attemptTaskName,
      systemPrompt: JOB_MATCH_SYSTEM_PROMPT,
      userPrompt: attempt.prompt,
      fallbackLabel: "job-match",
      model: attempt.model,
      timeoutMs: attempt.timeoutMs,
    });
    if (!aiResult.ok) {
      lastDiagnostic = aiResult.diagnostic;
      logAiAttempt(attemptTaskName, attempt.attempt, aiResult.diagnostic);
      continue;
    }
    const sanitized = sanitizeJobMatchAIAnalysis(aiResult.data, aiResult.model);
    if (!sanitized || !isValidJobMatchAIAnalysis(sanitized)) {
      lastDiagnostic = {
        hasApiKey: config.hasApiKey,
        model: aiResult.model,
        reason: "json_validation_failed",
        jsonValidationFailed: true,
      };
      logAiAttempt(attemptTaskName, attempt.attempt, lastDiagnostic);
      continue;
    }
    if (truncated) {
      sanitized.aiWarnings = [
        "Job description was capped for analysis.",
        ...sanitized.aiWarnings,
      ].slice(0, 6);
    }
    return { success: true, analysis: sanitized };
  }

  return { success: false, diagnostic: lastDiagnostic };
}
