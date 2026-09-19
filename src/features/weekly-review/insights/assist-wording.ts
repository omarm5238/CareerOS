import { generateJsonWithAI } from "@/server/ai/generate-json-with-ai";

import type { WeeklyCareerFacts, WeeklyInsightDraft, WeeklyMomentumResult, WeeklyRecommendationDraft } from "../types";

type WordingResult = {
  source: "DETERMINISTIC" | "AI_ASSISTED" | "FALLBACK";
  summary: string;
  wins: string[];
  friction: string[];
  insightSummaries: Record<string, string>;
  recommendationReasons: Record<string, string>;
};

const BLOCKED_CLAIM =
  /probably|likely|recruiters prefer|posting leads to|applying more causes|hiring probability|you perform better|viral|offer is coming|unknown company|success rate/i;

function fallbackSummary(facts: WeeklyCareerFacts, momentum: WeeklyMomentumResult): string {
  if (momentum.overallScore === null) {
    return "Not enough applicable data yet for a Career Momentum score. The facts below are still recorded for this week.";
  }
  if (momentum.firstReview) {
    return `This is your first weekly baseline. Career Momentum is ${momentum.overallScore} (${momentum.band}). Future finalized reviews will show week-over-week changes.`;
  }
  const delta =
    momentum.overallDelta === null
      ? "No previous finalized week is available for comparison."
      : `This is ${momentum.overallDelta > 0 ? "+" : ""}${momentum.overallDelta} compared with the last finalized week.`;
  return `Career Momentum is ${momentum.overallScore} (${momentum.band}). ${delta}`;
}

export async function assistWeeklyReviewWording(input: {
  facts: WeeklyCareerFacts;
  momentum: WeeklyMomentumResult;
  wins: string[];
  friction: string[];
  insights: WeeklyInsightDraft[];
  recommendations: WeeklyRecommendationDraft[];
}): Promise<WordingResult> {
  const fallback: WordingResult = {
    source: "DETERMINISTIC",
    summary: fallbackSummary(input.facts, input.momentum),
    wins: input.wins,
    friction: input.friction,
    insightSummaries: Object.fromEntries(input.insights.map((item) => [item.fingerprint, item.summary])),
    recommendationReasons: Object.fromEntries(input.recommendations.map((item) => [item.fingerprint, item.reason])),
  };

  const model = process.env.OPENAI_WEEKLY_REVIEW_MODEL?.trim();
  if (!model) return fallback;

  const payload = {
    week: input.facts.period,
    score: input.momentum.overallScore,
    band: input.momentum.band,
    wins: input.wins,
    friction: input.friction,
    insights: input.insights.map((item) => ({
      fingerprint: item.fingerprint,
      type: item.type,
      summary: item.summary,
    })),
    recommendations: input.recommendations.map((item) => ({
      fingerprint: item.fingerprint,
      title: item.title,
      reason: item.reason,
    })),
  };

  const result = await generateJsonWithAI<{
    summary?: string;
    wins?: string[];
    friction?: string[];
    insights?: Array<{ fingerprint: string; summary: string }>;
    recommendations?: Array<{ fingerprint: string; reason: string }>;
  }>({
    taskName: "weekly-review-wording",
    model,
    timeoutMs: 12_000,
    temperature: 0.1,
    systemPrompt:
      "Rewrite concise professional weekly review prose using only the supplied facts. Do not invent companies, counts, statuses, interviews, offers, recruiter interest, probabilities, or causal claims. Keep fingerprints unchanged.",
    userPrompt: JSON.stringify(payload),
  });

  if (!result.ok || !result.data) {
    return { ...fallback, source: "FALLBACK" };
  }

  const next: WordingResult = { ...fallback, source: "AI_ASSISTED" };
  if (typeof result.data.summary === "string" && !BLOCKED_CLAIM.test(result.data.summary)) {
    next.summary = result.data.summary.slice(0, 420);
  }
  if (Array.isArray(result.data.wins) && result.data.wins.every((item) => typeof item === "string" && !BLOCKED_CLAIM.test(item))) {
    const allowed = result.data.wins.map((item) => item.trim()).filter(Boolean).slice(0, input.wins.length);
    if (allowed.length === input.wins.length) next.wins = allowed;
  }
  if (
    Array.isArray(result.data.friction) &&
    result.data.friction.every((item) => typeof item === "string" && !BLOCKED_CLAIM.test(item))
  ) {
    const allowed = result.data.friction.map((item) => item.trim()).filter(Boolean).slice(0, input.friction.length);
    if (allowed.length === input.friction.length) next.friction = allowed;
  }
  for (const item of result.data.insights ?? []) {
    if (!item || typeof item.fingerprint !== "string" || typeof item.summary !== "string") continue;
    if (!(item.fingerprint in next.insightSummaries)) continue;
    if (BLOCKED_CLAIM.test(item.summary)) continue;
    next.insightSummaries[item.fingerprint] = item.summary.slice(0, 360);
  }
  for (const item of result.data.recommendations ?? []) {
    if (!item || typeof item.fingerprint !== "string" || typeof item.reason !== "string") continue;
    if (!(item.fingerprint in next.recommendationReasons)) continue;
    if (BLOCKED_CLAIM.test(item.reason)) continue;
    next.recommendationReasons[item.fingerprint] = item.reason.slice(0, 360);
  }
  return next;
}
