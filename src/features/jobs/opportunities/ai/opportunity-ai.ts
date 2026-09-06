import { generateJsonWithAI, getAiConfig } from "@/server/ai";

import { sanitizeExtractedRequirements } from "../requirements/extract-job-requirements";
import type { JobRequirementInput, OpportunityWarning } from "../types";
import { OPPORTUNITY_SYSTEM_PROMPT, buildOpportunityUserPrompt } from "./opportunity-prompt";

type OpportunityAiPayload = {
  requirements?: unknown;
  summary?: unknown;
  whyYouMatch?: unknown;
  warnings?: unknown;
};

export type OpportunityAiResult =
  | {
      ok: true;
      requirements: JobRequirementInput[];
      summary: string | null;
      whyYouMatch: string[];
      warnings: OpportunityWarning[];
    }
  | { ok: false; reason: string };

function resolveModel(): string {
  const config = getAiConfig();
  return (
    process.env.OPENAI_OPPORTUNITY_MODEL?.trim() ||
    process.env.OPENAI_JOB_MATCH_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    config.model
  );
}

export async function extractRequirementsWithAi(input: {
  title: string;
  company: string;
  location: string | null;
  description: string;
  roleTargets: string[];
  evidenceLabels: string[];
}): Promise<OpportunityAiResult> {
  const result = await generateJsonWithAI<OpportunityAiPayload>({
    taskName: "opportunity-analyze",
    model: resolveModel(),
    temperature: 0.2,
    timeoutMs: Number(process.env.OPENAI_OPPORTUNITY_TIMEOUT_MS) || 45_000,
    systemPrompt: OPPORTUNITY_SYSTEM_PROMPT,
    userPrompt: buildOpportunityUserPrompt(input),
  });

  if (!result.ok) {
    return { ok: false, reason: result.diagnostic.reason };
  }

  const requirements = sanitizeExtractedRequirements(result.data.requirements);
  const whyYouMatch = Array.isArray(result.data.whyYouMatch)
    ? result.data.whyYouMatch.filter((item): item is string => typeof item === "string").slice(0, 6)
    : [];
  const warnings = Array.isArray(result.data.warnings)
    ? result.data.warnings
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          code: typeof item.code === "string" ? item.code : "ai",
          message: typeof item.message === "string" ? item.message : "",
        }))
        .filter((item) => item.message)
        .slice(0, 8)
    : [];

  return {
    ok: true,
    requirements,
    summary: typeof result.data.summary === "string" ? result.data.summary.slice(0, 400) : null,
    whyYouMatch,
    warnings,
  };
}
