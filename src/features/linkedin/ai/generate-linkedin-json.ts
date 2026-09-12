import { generateJsonWithAI } from "@/server/ai";
import type { AiDiagnostic } from "@/server/ai";

import { resolveLinkedinModel } from "./resolve-linkedin-model";

export type LinkedinAiResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; diagnostic: AiDiagnostic };

export async function generateLinkedinJson<T>(options: {
  taskName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<LinkedinAiResult<T>> {
  const model = resolveLinkedinModel();
  const result = await generateJsonWithAI<T>({
    taskName: options.taskName,
    model,
    temperature: options.temperature ?? 0.2,
    timeoutMs: Number(process.env.OPENAI_LINKEDIN_TIMEOUT_MS) || 40_000,
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
  });

  if (!result.ok) {
    return { ok: false, diagnostic: result.diagnostic };
  }
  return { ok: true, data: result.data, model: result.model };
}
