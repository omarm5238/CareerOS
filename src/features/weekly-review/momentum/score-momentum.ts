import type { WeeklyCareerFacts, WeeklyComponentResult, WeeklyMomentumResult, WeeklySubSignal } from "../types";
import { MOMENTUM_WEIGHTS } from "../types";

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bandFromScore(score: number | null): WeeklyMomentumResult["band"] {
  if (score === null) return null;
  if (score >= 80) return "STRONG";
  if (score >= 65) return "STEADY";
  if (score >= 45) return "MIXED";
  return "LOW";
}

function ratio(numerator: number, denominator: number, max: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, numerator / denominator) * max;
}

function signal(
  key: string,
  label: string,
  applicability: WeeklySubSignal["applicability"],
  score: number,
  maxScore: number,
  evidence: string,
): WeeklySubSignal {
  return {
    key,
    label,
    applicability,
    score: applicability === "DATA_AVAILABLE" || applicability === "NO_ACTIVITY" ? score : 0,
    maxScore,
    evidence,
  };
}

function componentFromSignals(
  key: WeeklyComponentResult["key"],
  label: string,
  maxScore: number,
  subSignals: WeeklySubSignal[],
): WeeklyComponentResult {
  const applicable = subSignals.filter(
    (item) => item.applicability === "DATA_AVAILABLE" || item.applicability === "NO_ACTIVITY",
  );
  if (applicable.length === 0) {
    return {
      key,
      label,
      score: null,
      maxScore,
      applicability: "NOT_APPLICABLE",
      evidenceSummary: "Not applicable this week.",
      subSignals,
    };
  }
  const earned = applicable.reduce((sum, item) => sum + item.score, 0);
  const available = applicable.reduce((sum, item) => sum + item.maxScore, 0);
  const scaled = available > 0 ? (earned / available) * maxScore : 0;
  const noActivity = applicable.every((item) => item.applicability === "NO_ACTIVITY");
  return {
    key,
    label,
    score: Math.round(scaled * 10) / 10,
    maxScore,
    applicability: noActivity ? "NO_ACTIVITY" : "DATA_AVAILABLE",
    evidenceSummary: applicable.map((item) => item.evidence).filter(Boolean).slice(0, 3).join(" "),
    subSignals,
  };
}

function scoreExecution(facts: WeeklyCareerFacts): WeeklyComponentResult {
  const scheduled =
    facts.execution.scheduledDays > 0
      ? signal(
          "scheduled-days",
          "Scheduled-day participation",
          "DATA_AVAILABLE",
          ratio(facts.execution.activeDays, facts.execution.scheduledDays, 10),
          10,
          `${facts.execution.activeDays} of ${facts.execution.scheduledDays} scheduled career days were active.`,
        )
      : signal("scheduled-days", "Scheduled-day participation", "NOT_APPLICABLE", 0, 10, "No scheduled career days.");

  let completion: WeeklySubSignal;
  if (facts.execution.corePlanned > 0) {
    const score = ratio(facts.execution.coreCompleted, facts.execution.corePlanned, 10);
    completion = signal(
      "core-completion",
      "Meaningful core completion",
      facts.execution.coreCompleted === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
      facts.execution.coreCompleted === 0 ? 0 : score,
      10,
      `${facts.execution.coreCompleted} of ${facts.execution.corePlanned} meaningful core actions completed.`,
    );
  } else {
    completion = signal(
      "core-completion",
      "Meaningful core completion",
      "NOT_APPLICABLE",
      0,
      10,
      "No meaningful core work was planned.",
    );
  }

  let carry: WeeklySubSignal;
  if (facts.execution.corePlanned === 0 && facts.execution.carryOver === 0) {
    carry = signal("carry-over", "Carry-over health", "NOT_APPLICABLE", 0, 5, "No planned work context.");
  } else {
    const repeated = facts.execution.repeatedCarryOverIntents;
    const map = repeated <= 1 ? 5 : repeated === 2 ? 4 : repeated === 3 ? 3 : repeated === 4 ? 2 : 0;
    carry = signal(
      "carry-over",
      "Carry-over health",
      "DATA_AVAILABLE",
      map,
      5,
      `${repeated} distinct intents were carried over more than once.`,
    );
  }

  return componentFromSignals("execution", "Execution", MOMENTUM_WEIGHTS.execution, [scheduled, completion, carry]);
}

function scoreApplications(facts: WeeklyCareerFacts): WeeklyComponentResult {
  let submission: WeeklySubSignal;
  if (facts.applications.actionableReadyCount > 0 || facts.applications.submitted.value > 0) {
    const denominator = Math.max(facts.applications.actionableReadyCount, facts.applications.submitted.value);
    const score = ratio(facts.applications.submitted.value, denominator, 8);
    submission = signal(
      "submission",
      "Submission execution",
      facts.applications.submitted.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
      facts.applications.submitted.value === 0 ? 0 : score,
      8,
      `${facts.applications.submitted.value} of ${denominator} actionable opportunities were submitted.`,
    );
  } else {
    submission = signal("submission", "Submission execution", "NOT_APPLICABLE", 0, 8, "No actionable application opportunity.");
  }

  let followUp: WeeklySubSignal;
  if (!facts.applications.followUpDueReliable) {
    followUp = signal("follow-up", "Follow-up execution", "UNAVAILABLE", 0, 5, "Due follow-up history could not be reconstructed.");
  } else if (facts.applications.followUpsDue.value > 0) {
    const score = ratio(facts.applications.followUpsCompleted.value, facts.applications.followUpsDue.value, 5);
    followUp = signal(
      "follow-up",
      "Follow-up execution",
      facts.applications.followUpsCompleted.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
      facts.applications.followUpsCompleted.value === 0 ? 0 : score,
      5,
      `${facts.applications.followUpsCompleted.value} of ${facts.applications.followUpsDue.value} due follow-ups completed.`,
    );
  } else {
    followUp = signal("follow-up", "Follow-up execution", "NOT_APPLICABLE", 0, 5, "No follow-ups were due.");
  }

  let stage: WeeklySubSignal;
  if (facts.applications.activeSubmittedCohort > 0 || facts.applications.stageProgressions.length > 0) {
    const progressions = facts.applications.stageProgressions.length;
    const mapped = progressions <= 0 ? 0 : progressions === 1 ? 4 : 8;
    stage = signal(
      "stage",
      "Stage progression",
      "DATA_AVAILABLE",
      mapped,
      8,
      `${progressions} positive stage progression${progressions === 1 ? "" : "s"} recorded.`,
    );
  } else {
    stage = signal("stage", "Stage progression", "NOT_APPLICABLE", 0, 8, "No relevant submitted applications.");
  }

  let prep: WeeklySubSignal;
  if (facts.applications.interviewAssessmentRequired.value > 0) {
    const score = ratio(
      facts.applications.interviewAssessmentPrep.value,
      facts.applications.interviewAssessmentRequired.value,
      4,
    );
    prep = signal(
      "prep",
      "Interview / assessment preparation",
      facts.applications.interviewAssessmentPrep.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
      facts.applications.interviewAssessmentPrep.value === 0 ? 0 : score,
      4,
      `${facts.applications.interviewAssessmentPrep.value} of ${facts.applications.interviewAssessmentRequired.value} interview/assessment prep opportunities completed.`,
    );
  } else {
    prep = signal(
      "prep",
      "Interview / assessment preparation",
      "NOT_APPLICABLE",
      0,
      4,
      "No interview or assessment preparation was required.",
    );
  }

  return componentFromSignals("applications", "Applications", MOMENTUM_WEIGHTS.applications, [
    submission,
    followUp,
    stage,
    prep,
  ]);
}

function scoreOpportunities(facts: WeeklyCareerFacts): WeeklyComponentResult {
  const strong = facts.opportunities.strongActionable;
  const review =
    strong > 0
      ? signal(
          "review",
          "Review strong opportunities",
          facts.opportunities.strongReviewed.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
          facts.opportunities.strongReviewed.value === 0
            ? 0
            : ratio(facts.opportunities.strongReviewed.value, strong, 5),
          5,
          `${facts.opportunities.strongReviewed.value} of ${strong} strong opportunities reviewed.`,
        )
      : signal("review", "Review strong opportunities", "NOT_APPLICABLE", 0, 5, "No strong opportunities.");

  const prepare =
    strong > 0
      ? signal(
          "prepare",
          "Prepare strong opportunities",
          facts.opportunities.strongPrepared.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
          facts.opportunities.strongPrepared.value === 0
            ? 0
            : ratio(facts.opportunities.strongPrepared.value, strong, 7),
          7,
          `${facts.opportunities.strongPrepared.value} strong opportunities prepared.`,
        )
      : signal("prepare", "Prepare strong opportunities", "NOT_APPLICABLE", 0, 7, "No strong opportunities required preparation.");

  const preparedCount = facts.opportunities.strongPrepared.value;
  const handoff =
    preparedCount > 0
      ? signal(
          "handoff",
          "Handoff / readiness",
          "DATA_AVAILABLE",
          ratio(
            facts.opportunities.readyToApply.value + facts.opportunities.handedOff.value,
            preparedCount,
            5,
          ),
          5,
          `${facts.opportunities.readyToApply.value} ready-to-apply and ${facts.opportunities.handedOff.value} handed off of ${preparedCount} prepared.`,
        )
      : signal("handoff", "Handoff / readiness", "NOT_APPLICABLE", 0, 5, "No prepared opportunities.");

  let stale: WeeklySubSignal;
  if (strong > 0) {
    const expired = facts.opportunities.expiredUnacted.value;
    const mapped = expired === 0 ? 3 : expired === 1 ? 2 : expired === 2 ? 1 : 0;
    stale = signal(
      "expired",
      "Avoid stale strong roles",
      "DATA_AVAILABLE",
      mapped,
      3,
      `${expired} strong opportunities expired before action.`,
    );
  } else {
    stale = signal("expired", "Avoid stale strong roles", "NOT_APPLICABLE", 0, 3, "No strong opportunity cohort.");
  }

  return componentFromSignals("opportunities", "Opportunities", MOMENTUM_WEIGHTS.opportunities, [
    review,
    prepare,
    handoff,
    stale,
  ]);
}

function scoreVisibility(facts: WeeklyCareerFacts): WeeklyComponentResult {
  if (!facts.preferences.includeLinkedIn || !facts.preferences.hasLinkedinProfile) {
    return componentFromSignals("visibility", "Visibility", MOMENTUM_WEIGHTS.visibility, [
      signal("linkedin", "LinkedIn participation", "NOT_APPLICABLE", 0, 15, "Visibility did not apply this week."),
    ]);
  }

  const readyCount = facts.linkedin.ready.value + facts.linkedin.readyUnpublished.value;
  const publish =
    readyCount > 0 || facts.linkedin.published.value > 0
      ? signal(
          "publish",
          "Planned publishing execution",
          facts.linkedin.published.value === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
          facts.linkedin.published.value === 0
            ? 0
            : ratio(facts.linkedin.published.value, Math.max(readyCount, facts.linkedin.published.value), 7),
          7,
          `${facts.linkedin.published.value} LinkedIn plans/posts published.`,
        )
      : signal("publish", "Planned publishing execution", "NOT_APPLICABLE", 0, 7, "No READY publishing plans.");

  const readiness =
    facts.linkedin.ready.value > 0 || facts.linkedin.published.value > 0
      ? signal(
          "ready",
          "Content readiness",
          "DATA_AVAILABLE",
          Math.min(3, facts.linkedin.ready.value > 0 || facts.linkedin.published.value > 0 ? 3 : 0),
          3,
          `${facts.linkedin.ready.value} READY publishing plans existed.`,
        )
      : signal("ready", "Content readiness", "NOT_APPLICABLE", 0, 3, "No readiness/review progress.");

  const gap =
    facts.linkedin.visibilityGapActions.value > 0
      ? signal(
          "gap",
          "Visibility gap action",
          "DATA_AVAILABLE",
          3,
          3,
          `${facts.linkedin.visibilityGapActions.value} visibility-related actions completed.`,
        )
      : signal("gap", "Visibility gap action", "NOT_APPLICABLE", 0, 3, "No grounded visibility-gap actions.");

  const profile =
    facts.linkedin.profileImprovementActions.value > 0
      ? signal(
          "profile",
          "Profile improvement",
          "DATA_AVAILABLE",
          2,
          2,
          `${facts.linkedin.profileImprovementActions.value} profile-improvement actions completed.`,
        )
      : signal("profile", "Profile improvement", "NOT_APPLICABLE", 0, 2, "No profile-improvement need acted on.");

  return componentFromSignals("visibility", "Visibility", MOMENTUM_WEIGHTS.visibility, [
    publish,
    readiness,
    gap,
    profile,
  ]);
}

function scoreSkills(facts: WeeklyCareerFacts): WeeklyComponentResult {
  if (!facts.preferences.includeSkillDevelopment) {
    return componentFromSignals("skills", "Skills & Evidence", MOMENTUM_WEIGHTS.skills, [
      signal("skills", "Skill development", "NOT_APPLICABLE", 0, 15, "Skill development was not included this week."),
    ]);
  }

  const planned = facts.skillsEvidence.skillActionsPlanned;
  const completed =
    facts.skillsEvidence.skillActionsCompleted.value + facts.skillsEvidence.evidenceActionsCompleted.value;
  const completion =
    planned > 0
      ? signal(
          "skill-actions",
          "Skill/evidence action completion",
          completed === 0 ? "NO_ACTIVITY" : "DATA_AVAILABLE",
          completed === 0 ? 0 : ratio(completed, planned, 8),
          8,
          `${completed} of ${planned} skill/evidence core actions completed.`,
        )
      : signal(
          "skill-actions",
          "Skill/evidence action completion",
          "NOT_APPLICABLE",
          0,
          8,
          "No skill/evidence core work was planned.",
        );

  const recurring =
    facts.skillsEvidence.recurringGapsAddressed.value > 0
      ? signal(
          "recurring",
          "Recurring demand addressed",
          "DATA_AVAILABLE",
          5,
          5,
          `${facts.skillsEvidence.recurringGapsAddressed.value} recurring requirement${facts.skillsEvidence.recurringGapsAddressed.value === 1 ? "" : "s"} addressed.`,
        )
      : facts.skillsEvidence.remainingGaps.length > 0
        ? signal("recurring", "Recurring demand addressed", "NO_ACTIVITY", 0, 5, "Recurring job demand was not addressed.")
        : signal("recurring", "Recurring demand addressed", "NOT_APPLICABLE", 0, 5, "No recurring demand identified.");

  const remaining = facts.skillsEvidence.remainingGaps;
  const addressed = facts.skillsEvidence.recurringGapsAddressed.value;
  const gap =
    remaining.length + addressed > 0
      ? signal(
          "evidence-gap",
          "Evidence gap reduction",
          addressed > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY",
          addressed > 0 ? 2 : 0,
          2,
          addressed > 0
            ? `${addressed} evidence gap${addressed === 1 ? "" : "s"} reduced.`
            : "Known evidence gaps were not reduced.",
        )
      : signal("evidence-gap", "Evidence gap reduction", "NOT_APPLICABLE", 0, 2, "No known evidence gap.");

  return componentFromSignals("skills", "Skills & Evidence", MOMENTUM_WEIGHTS.skills, [completion, recurring, gap]);
}

export function scoreWeeklyMomentum(
  facts: WeeklyCareerFacts,
  previous?: { overallScore: number | null; components: WeeklyComponentResult[] } | null,
): WeeklyMomentumResult {
  const components = [
    scoreExecution(facts),
    scoreApplications(facts),
    scoreOpportunities(facts),
    scoreVisibility(facts),
    scoreSkills(facts),
  ].map((component) => {
    const previousComponent = previous?.components.find((item) => item.key === component.key);
    const previousScore = previousComponent?.score ?? null;
    return {
      ...component,
      previousScore,
      delta:
        component.score === null || previousScore === null ? null : Math.round((component.score - previousScore) * 10) / 10,
    };
  });

  const applicable = components.filter((component) => component.applicability !== "NOT_APPLICABLE" && component.score !== null);
  const overallScore =
    applicable.length === 0
      ? null
      : roundScore(
          (100 * applicable.reduce((sum, component) => sum + (component.score ?? 0), 0)) /
            applicable.reduce((sum, component) => sum + component.maxScore, 0),
        );

  const previousOverallScore = previous?.overallScore ?? null;
  return {
    overallScore,
    band: bandFromScore(overallScore),
    components,
    previousOverallScore,
    overallDelta:
      overallScore === null || previousOverallScore === null ? null : overallScore - previousOverallScore,
    firstReview: !previous,
  };
}

export function momentumBandFromScore(score: number): NonNullable<WeeklyMomentumResult["band"]> {
  return bandFromScore(score) ?? "LOW";
}
