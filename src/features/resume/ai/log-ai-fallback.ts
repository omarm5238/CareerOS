import {
  buildAiDiagnostic,
  getAiConfig,
  getOpenAIModelName,
  logAiFallback,
  type AiDiagnostic,
} from "@/server/ai";

export type ResumeAiFallbackDiagnostic = AiDiagnostic;

export { getOpenAIModelName };

export function buildFallbackDiagnostic(
  reason: string,
  extras: Omit<ResumeAiFallbackDiagnostic, "hasApiKey" | "model" | "reason"> = {},
): ResumeAiFallbackDiagnostic {
  const config = getAiConfig();
  return buildAiDiagnostic(reason, extras, {
    hasApiKey: config.hasApiKey,
    model: config.model,
  });
}

export function logResumeAiFallback(diagnostic: ResumeAiFallbackDiagnostic): void {
  logAiFallback("resume-ai", diagnostic);
}
