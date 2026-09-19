import type { WeeklyCareerFacts, WeeklyInsightDraft, WeeklyRecommendationDraft } from "../types";
import { recommendationFingerprint } from "../lib/fingerprint";
import { DEFAULT_RECOMMENDATIONS, MAX_RECOMMENDATIONS } from "../types";

function recommendation(
  category: WeeklyRecommendationDraft["category"],
  intent: string,
  identity: string,
  title: string,
  reason: string,
  priority: WeeklyRecommendationDraft["priority"],
  recommendedActionType: string | null,
  deepLink: string,
  evidence: Record<string, unknown>,
): WeeklyRecommendationDraft {
  return {
    category,
    title,
    reason,
    priority,
    sourceEvidence: evidence,
    recommendedActionType,
    deepLink,
    fingerprint: recommendationFingerprint({ category, intent, identity }),
  };
}

export function buildWeeklyRecommendations(
  facts: WeeklyCareerFacts,
  insights: WeeklyInsightDraft[],
): WeeklyRecommendationDraft[] {
  const drafts: WeeklyRecommendationDraft[] = [];
  const types = new Set(insights.map((item) => item.type));

  if (types.has("FOLLOW_UP_GAP")) {
    drafts.push(
      recommendation(
        "FOLLOW_UP",
        "follow-up-outstanding",
        "applications",
        "Prioritize outstanding application follow-ups",
        `${facts.applications.followUpsDue.value} follow-ups were due and none were completed. Start next week with the oldest due follow-up.`,
        "HIGH",
        "APPLICATION_FOLLOW_UP",
        "/workspace/applications",
        { due: facts.applications.followUpsDue.value },
      ),
    );
  }
  if (types.has("OPPORTUNITY_GAP")) {
    drafts.push(
      recommendation(
        "OPPORTUNITIES",
        "prepare-strong",
        "jobs-queue",
        "Prepare the top strong opportunities first",
        "Strong opportunities outpaced preparation. Prepare existing strong roles before expanding discovery.",
        "HIGH",
        "JOB_PREPARE",
        "/workspace/jobs/queue",
        { strong: facts.opportunities.strongActionable, prepared: facts.opportunities.strongPrepared.value },
      ),
    );
  }
  if (types.has("EVIDENCE_GAP")) {
    drafts.push(
      recommendation(
        "SKILLS_EVIDENCE",
        "evidence-recurring",
        facts.skillsEvidence.remainingGaps[0] ?? "skills",
        "Complete one evidence-building action",
        "A recurring target-job requirement still lacks completed evidence-building work.",
        "MEDIUM",
        "EVIDENCE_BUILDING",
        "/workspace/skills",
        { remaining: facts.skillsEvidence.remainingGaps.slice(0, 3) },
      ),
    );
  }
  if (types.has("VISIBILITY_GAP")) {
    drafts.push(
      recommendation(
        "LINKEDIN",
        "publish-ready",
        "linkedin-ready",
        "Publish an existing READY LinkedIn post",
        "READY LinkedIn work remained unpublished. Publish an existing post before creating more drafts.",
        "MEDIUM",
        "LINKEDIN_PUBLISH",
        "/workspace/linkedin",
        { readyUnpublished: facts.linkedin.readyUnpublished.value },
      ),
    );
  }
  if (types.has("CONSISTENCY_PATTERN")) {
    drafts.push(
      recommendation(
        "EXECUTION",
        "reduce-daily-load",
        "today-settings",
        "Reduce next week's daily load",
        "Scheduled career days were lightly used. Focus on fewer core actions next week.",
        "MEDIUM",
        "WEEKLY_PREP",
        "/workspace/today",
        { scheduled: facts.execution.scheduledDays, active: facts.execution.activeDays },
      ),
    );
  }
  if (types.has("STALL_PATTERN") && drafts.length < DEFAULT_RECOMMENDATIONS) {
    drafts.push(
      recommendation(
        "EXECUTION",
        "clear-repeated-carry",
        "today",
        "Clear one repeatedly carried action",
        "The same intents kept carrying over. Complete or skip one of them early next week.",
        "HIGH",
        "CUSTOM_CAREER_ACTION",
        "/workspace/today",
        { intents: facts.execution.repeatedIntentIds.slice(0, 3) },
      ),
    );
  }
  if (facts.applications.submitted.value === 0 && facts.applications.actionableReadyCount > 0 && drafts.length < DEFAULT_RECOMMENDATIONS) {
    drafts.push(
      recommendation(
        "APPLICATIONS",
        "submit-ready",
        "apply-now",
        "Submit one ready application",
        "An actionable ready application existed and was not submitted this week.",
        "HIGH",
        "JOB_APPLY",
        "/workspace/jobs/apply-now",
        { actionable: facts.applications.actionableReadyCount },
      ),
    );
  }

  const unique = new Map<string, WeeklyRecommendationDraft>();
  for (const item of drafts) {
    if (!unique.has(item.fingerprint)) unique.set(item.fingerprint, item);
  }
  return [...unique.values()].slice(0, MAX_RECOMMENDATIONS);
}
