import { generateJsonWithAI } from "@/server/ai/generate-json-with-ai";

import type { ScoredDailyActionCandidate } from "../types";

type WordingResult = {
  source: "DETERMINISTIC" | "AI_ASSISTED" | "FALLBACK";
  summary: string | null;
  whyNowByFingerprint: Record<string, string>;
};

function fallbackWhyNow(candidate: ScoredDailyActionCandidate): string {
  return candidate.whyNowFacts[0] ?? "This action is grounded in current CareerOS domain state.";
}

export async function assistDailyRoadmapWording(
  candidates: ScoredDailyActionCandidate[],
): Promise<WordingResult> {
  const fallback: WordingResult = {
    source: "DETERMINISTIC",
    summary: null,
    whyNowByFingerprint: Object.fromEntries(candidates.map((item) => [item.fingerprint, fallbackWhyNow(item)])),
  };

  const model = process.env.OPENAI_DAILY_ROADMAP_MODEL?.trim();
  if (!model) return fallback;

  const payload = candidates.map((item) => ({
    fingerprint: item.fingerprint,
    type: item.type,
    title: item.title,
    facts: item.whyNowFacts,
  }));

  const result = await generateJsonWithAI<{
    summary?: string;
    items?: Array<{ fingerprint: string; whyNow: string }>;
  }>({
    taskName: "daily-roadmap-wording",
    model,
    timeoutMs: 12_000,
    temperature: 0.1,
    systemPrompt:
      "Rewrite concise professional why-now sentences from provided facts only. Do not invent deadlines, interviews, recruiter interest, job quality, or outcomes. Do not change fingerprints.",
    userPrompt: JSON.stringify({ items: payload }),
  });

  if (!result.ok || !result.data) {
    return { ...fallback, source: "FALLBACK" };
  }

  const whyNowByFingerprint = { ...fallback.whyNowByFingerprint };
  for (const item of result.data.items ?? []) {
    if (!item || typeof item.fingerprint !== "string" || typeof item.whyNow !== "string") continue;
    if (!(item.fingerprint in whyNowByFingerprint)) continue;
    const text = item.whyNow.trim();
    if (!text) continue;
    if (/probably|viral|best chance|likely to get|recruiters are waiting/i.test(text)) continue;
    whyNowByFingerprint[item.fingerprint] = text.slice(0, 240);
  }

  return {
    source: "AI_ASSISTED",
    summary: typeof result.data.summary === "string" ? result.data.summary.slice(0, 280) : null,
    whyNowByFingerprint,
  };
}
