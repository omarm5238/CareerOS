import OpenAI from "openai";

import { limitResumeTextForAi } from "./limit-resume-text-for-ai";
import {
  buildFallbackDiagnostic,
  extractOpenAIErrorDetails,
  getOpenAIModelName,
  type ResumeAiFallbackDiagnostic,
} from "./log-ai-fallback";
import {
  RESUME_ANALYSIS_SYSTEM_PROMPT,
  buildResumeAnalysisUserPrompt,
} from "./prompts";
import {
  isValidResumeAIAnalysis,
  sanitizeResumeAIAnalysis,
} from "./resume-analysis-schema";
import type { OpenAIResumeAnalysisPayload, ResumeAIAnalysisCore } from "./types";

const AI_REQUEST_TIMEOUT_MS = 20_000;

export type AnalyzeResumeOpenAIResult =
  | { success: true; analysis: ResumeAIAnalysisCore }
  | { success: false; diagnostic: ResumeAiFallbackDiagnostic };

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = getOpenAIModelName();

  if (!apiKey) {
    return null;
  }

  return { apiKey, model };
}

function parseJsonContent(content: string): OpenAIResumeAnalysisPayload | null {
  try {
    return JSON.parse(content) as OpenAIResumeAnalysisPayload;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(content.slice(start, end + 1)) as OpenAIResumeAnalysisPayload;
    } catch {
      return null;
    }
  }
}

export async function analyzeResumeWithOpenAI(
  text: string,
): Promise<AnalyzeResumeOpenAIResult> {
  const config = getOpenAIConfig();
  if (!config) {
    return {
      success: false,
      diagnostic: buildFallbackDiagnostic("missing_api_key"),
    };
  }

  const { text: limitedText, truncated } = limitResumeTextForAi(text);
  const client = new OpenAI({ apiKey: config.apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: RESUME_ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildResumeAnalysisUserPrompt({
              resumeText: limitedText,
              truncated,
            }),
          },
        ],
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        diagnostic: buildFallbackDiagnostic("empty_response"),
      };
    }

    const payload = parseJsonContent(content);
    if (!payload) {
      return {
        success: false,
        diagnostic: buildFallbackDiagnostic("json_parse_failed", {
          jsonValidationFailed: true,
        }),
      };
    }

    const sanitized = sanitizeResumeAIAnalysis(payload, {
      analysisSource: "ai",
      model: config.model,
    });

    if (!sanitized || !isValidResumeAIAnalysis(sanitized)) {
      return {
        success: false,
        diagnostic: buildFallbackDiagnostic("json_validation_failed", {
          jsonValidationFailed: true,
        }),
      };
    }

    if (truncated) {
      sanitized.warnings = [
        "Resume text was truncated before AI analysis.",
        ...sanitized.warnings,
      ].slice(0, 5);
    }

    return { success: true, analysis: sanitized };
  } catch (error) {
    const errorDetails = extractOpenAIErrorDetails(error);
    return {
      success: false,
      diagnostic: buildFallbackDiagnostic(errorDetails.reason, errorDetails),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}
