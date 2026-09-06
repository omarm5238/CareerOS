import { generateJsonWithAI, getAiConfig, logAiAttempt } from "@/server/ai";
import type { AiDiagnostic } from "@/server/ai";

import type { CommunicationContext, CommunicationGenerationOutput, CommunicationTransformType } from "../types";
import {
  buildCommunicationUserPrompt,
  buildTransformUserPrompt,
  COMMUNICATION_SYSTEM_PROMPT,
} from "./communication-prompt";
import { sanitizeCommunicationOutput } from "./parse-communication-output";
import type { CommunicationAiOutcome } from "./types";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRY_TIMEOUT_MS = 25_000;

function envTimeout(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(60_000, Math.max(5_000, raw));
}

function resolveModels(): { primary: string; retry: string } {
  const config = getAiConfig();
  const primary =
    process.env.OPENAI_COMMUNICATIONS_MODEL?.trim() ||
    process.env.OPENAI_APPLICATIONS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    config.model;
  const retry = process.env.OPENAI_COMMUNICATIONS_FAST_MODEL?.trim() || primary;
  return { primary, retry };
}

async function runCommunicationAi(
  taskName: string,
  context: CommunicationContext,
  userPrompt: string,
): Promise<CommunicationAiOutcome> {
  const models = resolveModels();
  const attempts = [
    {
      attempt: 1,
      model: models.primary,
      timeoutMs: envTimeout("OPENAI_COMMUNICATIONS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
      prompt: userPrompt,
    },
    {
      attempt: 2,
      model: models.retry,
      timeoutMs: envTimeout("OPENAI_COMMUNICATIONS_RETRY_TIMEOUT_MS", DEFAULT_RETRY_TIMEOUT_MS),
      prompt: `${userPrompt}\n\nRetry: return valid JSON only. Do not invent facts.`,
    },
  ];

  let lastDiagnostic: AiDiagnostic = {
    hasApiKey: true,
    model: models.primary,
    reason: "no_attempt_completed",
  };

  for (const attempt of attempts) {
    const result = await generateJsonWithAI<CommunicationGenerationOutput>({
      taskName,
      model: attempt.model,
      timeoutMs: attempt.timeoutMs,
      temperature: 0.3,
      systemPrompt: COMMUNICATION_SYSTEM_PROMPT,
      userPrompt: attempt.prompt,
    });

    if (result.ok) {
      const sanitized = sanitizeCommunicationOutput(result.data, context);
      if (sanitized) {
        return { success: true, payload: sanitized, model: result.model };
      }
      lastDiagnostic = {
        hasApiKey: true,
        model: attempt.model,
        reason: "json_parse_failed",
        jsonValidationFailed: true,
      };
      logAiAttempt(taskName, attempt.attempt, lastDiagnostic);
      continue;
    }

    lastDiagnostic = result.diagnostic;
    logAiAttempt(taskName, attempt.attempt, lastDiagnostic);
  }

  return { success: false, diagnostic: lastDiagnostic };
}

export function generateCommunicationWithAi(context: CommunicationContext) {
  return runCommunicationAi(
    "communication-generate",
    context,
    buildCommunicationUserPrompt(context),
  );
}

export function transformCommunicationWithAi(
  context: CommunicationContext,
  transform: CommunicationTransformType,
  subject: string | null,
  content: string,
) {
  return runCommunicationAi(
    `communication-transform-${transform.toLowerCase()}`,
    context,
    buildTransformUserPrompt(context, transform, subject, content),
  );
}
