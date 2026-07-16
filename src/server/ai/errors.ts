import { getAiConfig } from "./config";
import type { AiDiagnostic } from "./types";

export function buildAiDiagnostic(
  reason: string,
  extras: Omit<AiDiagnostic, "hasApiKey" | "model" | "reason"> = {},
  config?: { hasApiKey: boolean; model: string },
): AiDiagnostic {
  const resolved = config ?? getAiConfig();

  return {
    hasApiKey: resolved.hasApiKey,
    model: resolved.model,
    reason,
    ...extras,
  };
}

function isRequestAbortedError(error: Error): boolean {
  if (error.name === "AbortError") return true;
  return /abort/i.test(error.message);
}

export function extractOpenAIErrorDetails(
  error: unknown,
): Pick<AiDiagnostic, "reason" | "timedOut" | "errorName" | "code" | "status" | "message"> {
  if (error instanceof Error && isRequestAbortedError(error)) {
    return {
      reason: error.name === "AbortError" ? "timeout" : "request_aborted",
      timedOut: true,
      errorName: error.name,
      message: error.message || "AI request timed out",
    };
  }

  if (error && typeof error === "object") {
    const apiError = error as {
      status?: number;
      code?: string;
      name?: string;
      message?: string;
      error?: { code?: string; type?: string; message?: string };
    };

    const code = apiError.code ?? apiError.error?.code;
    const reason = code ?? apiError.error?.type ?? apiError.name ?? "openai_error";
    const message =
      typeof apiError.message === "string"
        ? apiError.message
        : typeof apiError.error?.message === "string"
          ? apiError.error.message
          : undefined;

    return {
      reason,
      status: typeof apiError.status === "number" ? apiError.status : undefined,
      code,
      errorName: apiError.name,
      message,
    };
  }

  return { reason: "openai_error", message: "OpenAI request failed" };
}
