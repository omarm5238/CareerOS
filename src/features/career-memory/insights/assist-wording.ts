import { generateJsonWithAI } from "@/server/ai/generate-json-with-ai";

export async function assistMemoryWording(text: string): Promise<{ source: "DETERMINISTIC" | "AI_ASSISTED" | "FALLBACK"; text: string }> {
  const fallback = { source: "DETERMINISTIC" as const, text };
  const model = process.env.OPENAI_CAREER_MEMORY_MODEL?.trim();
  if (!model) return fallback;
  try {
    const result = await generateJsonWithAI<{ text?: string }>({
      taskName: "career-memory-wording",
      model,
      timeoutMs: 8_000,
      temperature: 0,
      systemPrompt:
        "Rewrite one short factual career-memory sentence using only the supplied text. Do not add companies, counts, skills, or causal claims.",
      userPrompt: JSON.stringify({ text }),
    });
    if (!result.ok || !result.data?.text || /probably|hiring|prefer rust|recruiters/i.test(result.data.text)) {
      return { source: "FALLBACK", text };
    }
    return { source: "AI_ASSISTED", text: result.data.text.slice(0, 180) };
  } catch {
    return { source: "FALLBACK", text };
  }
}
