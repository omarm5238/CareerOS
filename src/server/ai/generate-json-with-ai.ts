import { getOpenAIClient } from "./client";
import { getAiConfig } from "./config";
import { buildAiDiagnostic, extractOpenAIErrorDetails } from "./errors";
import { logAiDebug } from "./logger";
import { parseJsonContent } from "./json";
import { withAiTimeout } from "./timeout";
import type {
  GenerateJsonWithAiOptions,
  GenerateJsonWithAiResult,
} from "./types";

export async function generateJsonWithAI<T>(
  options: GenerateJsonWithAiOptions,
): Promise<GenerateJsonWithAiResult<T>> {
  const config = getAiConfig();
  const model = options.model ?? config.model;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const diagnosticBase = { hasApiKey: config.hasApiKey, model };

  if (!config.hasApiKey) {
    return {
      ok: false,
      diagnostic: buildAiDiagnostic("missing_api_key", {}, diagnosticBase),
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      ok: false,
      diagnostic: buildAiDiagnostic("missing_api_key", {}, diagnosticBase),
    };
  }

  logAiDebug(options.taskName, {
    hasApiKey: config.hasApiKey,
    model,
    reason: "request_start",
  });

  try {
    const timed = await withAiTimeout(
      (signal) =>
        client.chat.completions.create(
          {
            model,
            temperature: options.temperature ?? 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: options.systemPrompt },
              { role: "user", content: options.userPrompt },
            ],
          },
          { signal },
        ),
      timeoutMs,
    );

    if (!timed.ok) {
      return {
        ok: false,
        diagnostic: buildAiDiagnostic(
          "timeout",
          {
            timedOut: true,
            errorName: timed.errorName,
            message: timed.message,
          },
          diagnosticBase,
        ),
      };
    }

    const content = timed.value.choices[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        diagnostic: buildAiDiagnostic("empty_response", {}, diagnosticBase),
      };
    }

    const parsed = parseJsonContent<T>(content);
    if (!parsed) {
      return {
        ok: false,
        diagnostic: buildAiDiagnostic(
          "json_parse_failed",
          { jsonValidationFailed: true },
          diagnosticBase,
        ),
      };
    }

    return {
      ok: true,
      data: parsed,
      model,
    };
  } catch (error) {
    const errorDetails = extractOpenAIErrorDetails(error);
    return {
      ok: false,
      diagnostic: buildAiDiagnostic(errorDetails.reason, errorDetails, diagnosticBase),
    };
  }
}
