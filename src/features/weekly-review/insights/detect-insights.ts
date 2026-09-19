import type {
  WeeklyCareerFacts,
  WeeklyInsightDraft,
  WeeklyMomentumResult,
} from "../types";
import { insightFingerprint } from "../lib/fingerprint";
import { MAX_FRICTION, MAX_WINS } from "../types";

type HistoryReview = {
  weekStartLocalDate: string;
  insightTypes: string[];
  overallScore: number | null;
};

function confidenceForPattern(historyCount: number, repeats: number): WeeklyInsightDraft["confidence"] {
  if (historyCount <= 2) return "LOW";
  if (historyCount === 3) return repeats >= 2 ? "MEDIUM" : "LOW";
  if (repeats >= 3) return "HIGH";
  if (repeats >= 2) return "MEDIUM";
  return "LOW";
}

function insight(
  type: WeeklyInsightDraft["type"],
  category: WeeklyInsightDraft["category"],
  title: string,
  summary: string,
  identity: string,
  confidence: WeeklyInsightDraft["confidence"],
  severity: WeeklyInsightDraft["severity"],
  evidence: Record<string, unknown>,
): WeeklyInsightDraft {
  return {
    type,
    category,
    title,
    summary,
    confidence,
    severity,
    evidence,
    fingerprint: insightFingerprint({ type, category, identity }),
  };
}

export function detectWeeklyInsights(
  facts: WeeklyCareerFacts,
  momentum: WeeklyMomentumResult,
  history: HistoryReview[],
): { insights: WeeklyInsightDraft[]; wins: string[]; friction: string[] } {
  const comparable = history.length + 1;
  const repeats = (type: string) => history.filter((review) => review.insightTypes.includes(type)).length + 1;
  const insights: WeeklyInsightDraft[] = [];
  const wins: string[] = [];
  const friction: string[] = [];

  if (facts.applications.submitted.value > 0) {
    wins.push(`${facts.applications.submitted.value} application${facts.applications.submitted.value === 1 ? "" : "s"} submitted.`);
  }
  if (facts.applications.stageProgressions.length > 0) {
    const latest = facts.applications.stageProgressions.at(-1);
    wins.push(
      `${facts.applications.stageProgressions.length} stage progression${facts.applications.stageProgressions.length === 1 ? "" : "s"} recorded${latest ? `, including ${latest.fromStatus} → ${latest.toStatus}` : ""}.`,
    );
  }
  if (facts.opportunities.strongPrepared.value > 0) {
    wins.push(`${facts.opportunities.strongPrepared.value} strong opportunit${facts.opportunities.strongPrepared.value === 1 ? "y" : "ies"} prepared.`);
  }
  if (facts.linkedin.published.value > 0) {
    wins.push(`${facts.linkedin.published.value} LinkedIn post${facts.linkedin.published.value === 1 ? "" : "s"} published.`);
  }
  if (facts.execution.activeDays >= 4) {
    wins.push(`${facts.execution.activeDays} scheduled career days were active.`);
  }
  if (facts.resume.ready.value > 0) {
    wins.push(`${facts.resume.ready.value} resume version${facts.resume.ready.value === 1 ? "" : "s"} marked READY.`);
  }
  if (facts.communication.used.value > 0) {
    wins.push(`${facts.communication.used.value} communication draft${facts.communication.used.value === 1 ? "" : "s"} marked USED.`);
  }
  if (facts.skillsEvidence.evidenceActionsCompleted.value > 0) {
    wins.push(`${facts.skillsEvidence.evidenceActionsCompleted.value} evidence-building action${facts.skillsEvidence.evidenceActionsCompleted.value === 1 ? "" : "s"} completed.`);
  }

  if (facts.applications.followUpsDue.value >= 2 && facts.applications.followUpsCompleted.value === 0) {
    friction.push(`${facts.applications.followUpsDue.value} due follow-ups were not completed.`);
    insights.push(
      insight(
        "FOLLOW_UP_GAP",
        "FOLLOW_UP",
        "Follow-up work stayed open",
        `${facts.applications.followUpsDue.value} follow-ups were due and none were completed this week.`,
        "due-untouched",
        confidenceForPattern(comparable, repeats("FOLLOW_UP_GAP")),
        "ATTENTION",
        { due: facts.applications.followUpsDue.value, completed: 0 },
      ),
    );
  }
  if (facts.opportunities.strongActionable >= 3 && facts.opportunities.strongPrepared.value <= 1) {
    friction.push("Strong opportunities outpaced preparation.");
    insights.push(
      insight(
        "OPPORTUNITY_GAP",
        "OPPORTUNITIES",
        "Preparation lagged strong opportunities",
        `${facts.opportunities.strongActionable} strong opportunities were available and ${facts.opportunities.strongPrepared.value} were prepared.`,
        "strong-unprepared",
        confidenceForPattern(comparable, repeats("OPPORTUNITY_GAP")),
        "ATTENTION",
        { strong: facts.opportunities.strongActionable, prepared: facts.opportunities.strongPrepared.value },
      ),
    );
  }
  if (facts.execution.scheduledDays >= 4 && facts.execution.activeDays <= 2) {
    friction.push("Scheduled career days were mostly inactive.");
    insights.push(
      insight(
        "CONSISTENCY_PATTERN",
        "EXECUTION",
        "Scheduled days were lightly used",
        `${facts.execution.activeDays} of ${facts.execution.scheduledDays} scheduled career days had meaningful activity.`,
        "low-participation",
        confidenceForPattern(comparable, repeats("CONSISTENCY_PATTERN")),
        "ATTENTION",
        { scheduled: facts.execution.scheduledDays, active: facts.execution.activeDays },
      ),
    );
  }
  if (facts.preferences.includeLinkedIn && facts.linkedin.readyUnpublished.value >= 2 && facts.linkedin.published.value === 0) {
    friction.push("READY LinkedIn posts remained unpublished.");
    insights.push(
      insight(
        "VISIBILITY_GAP",
        "LINKEDIN",
        "READY posts were not published",
        `${facts.linkedin.readyUnpublished.value} READY LinkedIn plans stayed unpublished.`,
        "ready-unpublished",
        confidenceForPattern(comparable, repeats("VISIBILITY_GAP")),
        "ATTENTION",
        { readyUnpublished: facts.linkedin.readyUnpublished.value },
      ),
    );
  }
  if (
    facts.preferences.includeSkillDevelopment &&
    facts.skillsEvidence.remainingGaps.length > 0 &&
    facts.skillsEvidence.skillActionsPlanned > 0 &&
    facts.skillsEvidence.evidenceActionsCompleted.value === 0
  ) {
    friction.push("Evidence-building work for recurring job demand stayed incomplete.");
    insights.push(
      insight(
        "EVIDENCE_GAP",
        "SKILLS_EVIDENCE",
        "Recurring evidence work stayed open",
        "A recurring target-job requirement had an evidence-building action available and no qualifying completion occurred.",
        "recurring-unaddressed",
        confidenceForPattern(comparable, repeats("EVIDENCE_GAP")),
        "ATTENTION",
        { remaining: facts.skillsEvidence.remainingGaps.slice(0, 5) },
      ),
    );
  }
  if (facts.execution.repeatedCarryOverIntents >= 2) {
    friction.push("The same planned intents kept carrying over.");
    insights.push(
      insight(
        "STALL_PATTERN",
        "EXECUTION",
        "Repeated carry-over appeared",
        `${facts.execution.repeatedCarryOverIntents} distinct intents carried over more than once.`,
        "repeated-carry",
        confidenceForPattern(comparable, repeats("STALL_PATTERN")),
        "ATTENTION",
        { intents: facts.execution.repeatedIntentIds },
      ),
    );
  }
  if (facts.applications.submitted.value > 0 && facts.applications.followUpsCompleted.value === 0 && facts.applications.followUpsDue.value > 0) {
    insights.push(
      insight(
        "APPLICATION_FUNNEL_PATTERN",
        "APPLICATIONS",
        "Submissions outpaced follow-up",
        "Applications were submitted this week while due follow-up work stayed open.",
        "submit-no-followup",
        confidenceForPattern(comparable, repeats("APPLICATION_FUNNEL_PATTERN")),
        "INFO",
        { submitted: facts.applications.submitted.value, followUpsDue: facts.applications.followUpsDue.value },
      ),
    );
  } else if (facts.applications.stageProgressions.some((item) => item.toStatus === "SCREENING" || item.toStatus === "INTERVIEW")) {
    insights.push(
      insight(
        "APPLICATION_FUNNEL_PATTERN",
        "APPLICATIONS",
        "Applications moved into later stages",
        "Stage events this week include screening or interview progress.",
        "stage-forward",
        confidenceForPattern(comparable, repeats("APPLICATION_FUNNEL_PATTERN")),
        "INFO",
        { progressions: facts.applications.stageProgressions },
      ),
    );
  }

  if (facts.opportunities.expiredUnacted.value > 0) {
    friction.push(`${facts.opportunities.expiredUnacted.value} strong opportunit${facts.opportunities.expiredUnacted.value === 1 ? "y" : "ies"} expired before preparation.`);
  }

  if (comparable === 1) {
    insights.forEach((item) => {
      item.confidence = "LOW";
      item.summary = `This week showed ${item.summary.charAt(0).toLowerCase()}${item.summary.slice(1)} There is not enough history yet to establish a recurring pattern.`;
    });
  } else if (comparable === 2 && momentum.overallDelta !== null) {
    insights.push(
      insight(
        "PROGRESS_PATTERN",
        "EXECUTION",
        momentum.overallDelta >= 0 ? "Momentum increased from last finalized week" : "Momentum decreased from last finalized week",
        `Overall Career Momentum changed by ${momentum.overallDelta > 0 ? "+" : ""}${momentum.overallDelta} compared with the last finalized week.`,
        "wow-delta",
        "LOW",
        "INFO",
        { delta: momentum.overallDelta },
      ),
    );
  }

  void momentum;

  return {
    insights,
    wins: wins.slice(0, MAX_WINS),
    friction: friction.slice(0, MAX_FRICTION),
  };
}

export function confidenceLabel(confidence: WeeklyInsightDraft["confidence"]): string {
  if (confidence === "HIGH") return "Recurring pattern";
  if (confidence === "MEDIUM") return "Emerging pattern";
  return "Early signal";
}
