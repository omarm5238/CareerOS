export type ResumeAiFallbackDiagnostic = {
  hasApiKey: boolean;
  model: string;
  reason: string;
  timedOut?: boolean;
  jsonValidationFailed?: boolean;
  errorName?: string;
  code?: string;
  status?: number;
};

export function getOpenAIModelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.5-mini";
}

export function buildFallbackDiagnostic(
  reason: string,
  extras: Omit<ResumeAiFallbackDiagnostic, "hasApiKey" | "model" | "reason"> = {},
): ResumeAiFallbackDiagnostic {
  return {
    hasApiKey: !!process.env.OPENAI_API_KEY?.trim(),
    model: getOpenAIModelName(),
    reason,
    ...extras,
  };
}

export function logResumeAiFallback(diagnostic: ResumeAiFallbackDiagnostic): void {
  console.warn("[resume-ai] fallback", diagnostic);
}

export function extractOpenAIErrorDetails(
  error: unknown,
): Pick<ResumeAiFallbackDiagnostic, "reason" | "timedOut" | "errorName" | "code" | "status"> {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      reason: "timeout",
      timedOut: true,
      errorName: error.name,
    };
  }

  if (error && typeof error === "object") {
    const apiError = error as {
      status?: number;
      code?: string;
      name?: string;
      error?: { code?: string; type?: string };
    };

    const code = apiError.code ?? apiError.error?.code;
    const reason = code ?? apiError.error?.type ?? apiError.name ?? "openai_error";

    return {
      reason,
      status: typeof apiError.status === "number" ? apiError.status : undefined,
      code,
      errorName: apiError.name,
    };
  }

  return { reason: "openai_error" };
}
