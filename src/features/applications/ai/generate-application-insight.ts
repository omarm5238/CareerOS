import { generateJsonWithAI, getAiConfig, logAiAttempt } from "@/server/ai";
import type { AiDiagnostic } from "@/server/ai";

import type { ApplicationStagePrep } from "../types";
import {
  APPLICATION_NEXT_ACTION_SYSTEM_PROMPT,
  APPLICATION_REJECTION_SYSTEM_PROMPT,
  APPLICATION_STAGE_PREP_SYSTEM_PROMPT,
  buildNextActionUserPrompt,
  buildRejectionUserPrompt,
  buildRetryPrompt,
  buildStagePrepUserPrompt,
} from "./prompts";
import type { ApplicationAiContext } from "./types";

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
    process.env.OPENAI_APPLICATIONS_MODEL?.trim() ||
    process.env.OPENAI_ANALYTICS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    config.model;
  const retry = process.env.OPENAI_APPLICATIONS_FAST_MODEL?.trim() || primary;
  return { primary, retry };
}

export type ApplicationAiOutcome<T> =
  | { success: true; payload: T; model: string | null }
  | { success: false; diagnostic: AiDiagnostic };

type AiTask = "next-action" | "stage-prep" | "rejection";

/**
 * Two-attempt AI call shared by all three insight types.
 *
 * The caller sanitizes the payload, so an attempt is treated as failed when
 * sanitization rejects it and the loop falls through to the retry model.
 */
async function runApplicationAi<T>(
  task: AiTask,
  context: ApplicationAiContext,
  systemPrompt: string,
  userPrompt: string,
  sanitize: (payload: unknown) => T | null,
  stage?: string,
): Promise<ApplicationAiOutcome<T>> {
  const models = resolveModels();
  const taskName = `application-${task}`;

  const attempts = [
    {
      attempt: 1,
      model: models.primary,
      timeoutMs: envTimeout("OPENAI_APPLICATIONS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
      prompt: userPrompt,
    },
    {
      attempt: 2,
      model: models.retry,
      timeoutMs: envTimeout("OPENAI_APPLICATIONS_RETRY_TIMEOUT_MS", DEFAULT_RETRY_TIMEOUT_MS),
      prompt: buildRetryPrompt(context, task, stage),
    },
  ];

  let lastDiagnostic: AiDiagnostic = {
    hasApiKey: true,
    model: models.primary,
    reason: "no_attempt_completed",
  };

  for (const attempt of attempts) {
    const result = await generateJsonWithAI<unknown>({
      taskName: `${taskName}-attempt-${attempt.attempt}`,
      systemPrompt,
      userPrompt: attempt.prompt,
      fallbackLabel: taskName,
      model: attempt.model,
      timeoutMs: attempt.timeoutMs,
      temperature: 0.2,
    });

    if (!result.ok) {
      lastDiagnostic = result.diagnostic;
      logAiAttempt(taskName, attempt.attempt, result.diagnostic);
      continue;
    }

    const sanitized = sanitize(result.data);
    if (!sanitized) {
      lastDiagnostic = {
        hasApiKey: true,
        model: attempt.model,
        reason: "json_validation_failed",
        jsonValidationFailed: true,
      };
      logAiAttempt(taskName, attempt.attempt, lastDiagnostic);
      continue;
    }

    return { success: true, payload: sanitized, model: result.model ?? attempt.model };
  }

  return { success: false, diagnostic: lastDiagnostic };
}

export function generateApplicationNextAction<T>(
  context: ApplicationAiContext,
  sanitize: (payload: unknown) => T | null,
) {
  return runApplicationAi(
    "next-action",
    context,
    APPLICATION_NEXT_ACTION_SYSTEM_PROMPT,
    buildNextActionUserPrompt(context),
    sanitize,
  );
}

export function generateApplicationStagePrep<T>(
  context: ApplicationAiContext,
  stage: ApplicationStagePrep["stage"],
  sanitize: (payload: unknown) => T | null,
) {
  return runApplicationAi(
    "stage-prep",
    context,
    APPLICATION_STAGE_PREP_SYSTEM_PROMPT,
    buildStagePrepUserPrompt(context, stage),
    sanitize,
    stage,
  );
}

export function generateApplicationRejectionAnalysis<T>(
  context: ApplicationAiContext,
  sanitize: (payload: unknown) => T | null,
) {
  return runApplicationAi(
    "rejection",
    context,
    APPLICATION_REJECTION_SYSTEM_PROMPT,
    buildRejectionUserPrompt(context),
    sanitize,
  );
}
