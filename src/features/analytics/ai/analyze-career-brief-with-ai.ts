import {
  generateJsonWithAI,
  getAiConfig,
  logAiAttempt,
  type AiDiagnostic,
} from "@/server/ai";

import { compactCareerBriefInputForAi } from "./compact-career-brief-input-for-ai";
import {
  CAREER_BRIEF_RESPONSE_SCHEMA,
  isValidCareerBriefResult,
  sanitizeCareerBriefAIAnalysis,
} from "./career-brief-schema";
import {
  CAREER_BRIEF_SYSTEM_PROMPT,
  buildCareerBriefRetryPrompt,
  buildCareerBriefUserPrompt,
} from "./prompts";
import type {
  CareerBriefAIPayload,
  CareerBriefAnalysisInput,
  CareerBriefResult,
} from "./types";

const DEFAULT_PRIMARY_TIMEOUT_MS = 45_000;
const DEFAULT_RETRY_TIMEOUT_MS = 25_000;

function readTimeout(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(60_000, Math.max(5_000, parsed));
}

export type AnalyzeCareerBriefWithAiResult =
  | { success: true; analysis: CareerBriefResult }
  | { success: false; diagnostic: AiDiagnostic };

export async function analyzeCareerBriefWithAi(
  input: CareerBriefAnalysisInput,
): Promise<AnalyzeCareerBriefWithAiResult> {
  const compactInput = compactCareerBriefInputForAi(input);
  const config = getAiConfig();
  const primaryModel =
    process.env.OPENAI_ANALYTICS_MODEL?.trim() || config.model;
  const retryModel =
    process.env.OPENAI_ANALYTICS_FAST_MODEL?.trim() || primaryModel;
  const attempts = [
    {
      model: primaryModel,
      timeoutMs: readTimeout(
        "OPENAI_ANALYTICS_TIMEOUT_MS",
        DEFAULT_PRIMARY_TIMEOUT_MS,
      ),
      prompt: buildCareerBriefUserPrompt(compactInput),
    },
    {
      model: retryModel,
      timeoutMs: readTimeout(
        "OPENAI_ANALYTICS_RETRY_TIMEOUT_MS",
        DEFAULT_RETRY_TIMEOUT_MS,
      ),
      prompt: buildCareerBriefRetryPrompt(compactInput),
    },
  ];

  let lastDiagnostic: AiDiagnostic = {
    hasApiKey: config.hasApiKey,
    model: primaryModel,
    reason: "unknown_ai_error",
  };

  for (const [index, attempt] of attempts.entries()) {
    const attemptNumber = index + 1;
    const aiResult = await generateJsonWithAI<CareerBriefAIPayload>({
      taskName: `career-brief-attempt-${attemptNumber}`,
      systemPrompt: CAREER_BRIEF_SYSTEM_PROMPT,
      userPrompt: attempt.prompt,
      timeoutMs: attempt.timeoutMs,
      model: attempt.model,
      temperature: 0.1,
      fallbackLabel: "career-brief",
      responseSchema: {
        name: "careeros_brief",
        schema: CAREER_BRIEF_RESPONSE_SCHEMA,
      },
    });

    if (!aiResult.ok) {
      lastDiagnostic = aiResult.diagnostic;
      logAiAttempt("career-brief", attemptNumber, lastDiagnostic);
      continue;
    }

    const sanitized = sanitizeCareerBriefAIAnalysis(
      aiResult.data,
      aiResult.model,
    );
    if (sanitized && isValidCareerBriefResult(sanitized)) {
      return { success: true, analysis: sanitized };
    }

    lastDiagnostic = {
      hasApiKey: config.hasApiKey,
      model: aiResult.model,
      reason: "json_validation_failed",
      jsonValidationFailed: true,
    };
    logAiAttempt("career-brief", attemptNumber, lastDiagnostic);
  }

  return { success: false, diagnostic: lastDiagnostic };
}
