import { generateJsonWithAI, getAiConfig, type AiDiagnostic } from "@/server/ai";

import { compactSkillsInsightInputForAi } from "./compact-skills-insight-input-for-ai";
import {
  isValidSkillsInsightResult,
  sanitizeSkillsInsightAIAnalysis,
} from "./skills-insight-schema";
import { SKILLS_INSIGHT_SYSTEM_PROMPT, buildSkillsInsightUserPrompt } from "./prompts";
import type {
  SkillsInsightAIPayload,
  SkillsInsightAnalysisInput,
  SkillsInsightResult,
} from "./types";

export const SKILLS_INSIGHT_TIMEOUT_MS = 45_000;

export type AnalyzeSkillsWithAiResult =
  | { success: true; analysis: SkillsInsightResult }
  | { success: false; diagnostic: AiDiagnostic };

export async function analyzeSkillsWithAi(
  input: SkillsInsightAnalysisInput,
): Promise<AnalyzeSkillsWithAiResult> {
  const compactInput = compactSkillsInsightInputForAi(input);

  const aiResult = await generateJsonWithAI<SkillsInsightAIPayload>({
    taskName: "skills-insight",
    systemPrompt: SKILLS_INSIGHT_SYSTEM_PROMPT,
    userPrompt: buildSkillsInsightUserPrompt(compactInput),
    timeoutMs: SKILLS_INSIGHT_TIMEOUT_MS,
    fallbackLabel: "skills-insight",
  });

  if (!aiResult.ok) {
    return { success: false, diagnostic: aiResult.diagnostic };
  }

  const sanitized = sanitizeSkillsInsightAIAnalysis(aiResult.data, aiResult.model);
  if (!sanitized || !isValidSkillsInsightResult(sanitized)) {
    const config = getAiConfig();
    return {
      success: false,
      diagnostic: {
        hasApiKey: config.hasApiKey,
        model: aiResult.model,
        reason: "json_validation_failed",
        jsonValidationFailed: true,
      },
    };
  }

  return { success: true, analysis: sanitized };
}
