import type { AiDiagnostic } from "./types";

type SafeAiLogPayload = {
  taskName: string;
  hasApiKey?: boolean;
  model?: string;
  reason?: string;
  status?: number;
  code?: string;
  timedOut?: boolean;
  jsonValidationFailed?: boolean;
  errorName?: string;
  message?: string;
};

function toSafePayload(taskName: string, diagnostic: AiDiagnostic): SafeAiLogPayload {
  return {
    taskName,
    hasApiKey: diagnostic.hasApiKey,
    model: diagnostic.model,
    reason: diagnostic.reason,
    status: diagnostic.status,
    code: diagnostic.code,
    timedOut: diagnostic.timedOut,
    jsonValidationFailed: diagnostic.jsonValidationFailed,
    errorName: diagnostic.errorName,
    message: diagnostic.message,
  };
}

export function logAiFallback(taskName: string, diagnostic: AiDiagnostic): void {
  console.warn(`[${taskName}] fallback`, toSafePayload(taskName, diagnostic));
}

export function logAiDebug(taskName: string, diagnostic: Partial<SafeAiLogPayload>): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info(`[${taskName}] debug`, {
    taskName,
    ...diagnostic,
  });
}
