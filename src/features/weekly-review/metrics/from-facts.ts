import type { WeeklyCareerFacts, WeeklyMetricDraft } from "../types";

function metric(
  category: WeeklyMetricDraft["category"],
  metricKey: string,
  sourceSubsystem: WeeklyMetricDraft["sourceSubsystem"],
  numericValue: number,
  denominatorValue: number | null,
  applicability: WeeklyMetricDraft["applicability"],
  evidence: Record<string, unknown>,
  textValue?: string,
): WeeklyMetricDraft {
  return {
    category,
    metricKey,
    numericValue,
    denominatorValue,
    applicability,
    sourceSubsystem,
    evidence,
    textValue: textValue ?? null,
  };
}

export function metricsFromFacts(facts: WeeklyCareerFacts): WeeklyMetricDraft[] {
  const executionDenom = facts.execution.scheduledDays;
  return [
    metric("EXECUTION", "execution.scheduled_days", "M26_DAILY", facts.execution.scheduledDays, null, executionDenom > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { localDates: facts.period }),
    metric("EXECUTION", "execution.active_days", "M26_DAILY", facts.execution.activeDays, facts.execution.scheduledDays, facts.execution.scheduledDays > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { activeDays: facts.execution.activeDays }),
    metric("EXECUTION", "execution.meaningful_actions", "M26_DAILY", facts.execution.meaningfulActions, null, "DATA_AVAILABLE", { count: facts.execution.meaningfulActions }),
    metric("EXECUTION", "execution.core_planned", "M26_DAILY", facts.execution.corePlanned, null, facts.execution.corePlanned > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", {}),
    metric("EXECUTION", "execution.core_completed", "M26_DAILY", facts.execution.coreCompleted, facts.execution.corePlanned, facts.execution.corePlanned > 0 ? (facts.execution.coreCompleted > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", {}),
    metric("EXECUTION", "execution.deferred", "M26_DAILY", facts.execution.deferred, null, "DATA_AVAILABLE", {}),
    metric("EXECUTION", "execution.skipped", "M26_DAILY", facts.execution.skipped, null, "DATA_AVAILABLE", {}),
    metric("EXECUTION", "execution.carry_over", "M26_DAILY", facts.execution.carryOver, null, "DATA_AVAILABLE", {}),
    metric("EXECUTION", "execution.repeated_carry_over", "M26_DAILY", facts.execution.repeatedCarryOverIntents, null, "DATA_AVAILABLE", { ids: facts.execution.repeatedIntentIds }),
    metric("EXECUTION", "execution.planned_minutes", "M26_DAILY", facts.execution.plannedMinutes, null, "DATA_AVAILABLE", {}),
    metric("EXECUTION", "execution.completed_estimated_minutes", "M26_DAILY", facts.execution.completedEstimatedMinutes, facts.execution.plannedMinutes, "DATA_AVAILABLE", {}),
    metric("APPLICATIONS", "applications.created", "M22_APPLICATION", facts.applications.created.value, null, "DATA_AVAILABLE", { ids: facts.applications.created.ids }),
    metric("APPLICATIONS", "applications.submitted", "M22_APPLICATION", facts.applications.submitted.value, facts.applications.actionableReadyCount, facts.applications.actionableReadyCount > 0 || facts.applications.submitted.value > 0 ? (facts.applications.submitted.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", { ids: facts.applications.submitted.ids }),
    metric("APPLICATIONS", "applications.stage_progressions", "M22_APPLICATION", facts.applications.stageProgressions.length, null, facts.applications.stageProgressions.length > 0 || facts.applications.activeSubmittedCohort > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { events: facts.applications.stageProgressions }),
    metric("FOLLOW_UP", "applications.followups_due", "M22_APPLICATION", facts.applications.followUpsDue.value, null, facts.applications.followUpsDue.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.applications.followUpsDue.ids }),
    metric("FOLLOW_UP", "applications.followups_completed", "M22_APPLICATION", facts.applications.followUpsCompleted.value, facts.applications.followUpsDue.value, facts.applications.followUpsDue.value > 0 ? (facts.applications.followUpsCompleted.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", { ids: facts.applications.followUpsCompleted.ids }),
    metric("APPLICATIONS", "applications.interview_assessment_prep", "M22_APPLICATION", facts.applications.interviewAssessmentPrep.value, facts.applications.interviewAssessmentRequired.value, facts.applications.interviewAssessmentRequired.value > 0 ? (facts.applications.interviewAssessmentPrep.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", {}),
    metric("OPPORTUNITIES", "opportunities.strong_discovered", "M23_JOBS", facts.opportunities.strongDiscovered.value, null, facts.opportunities.strongDiscovered.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.opportunities.strongDiscovered.ids }),
    metric("OPPORTUNITIES", "opportunities.strong_reviewed", "M23_JOBS", facts.opportunities.strongReviewed.value, facts.opportunities.strongActionable, facts.opportunities.strongActionable > 0 ? (facts.opportunities.strongReviewed.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", { ids: facts.opportunities.strongReviewed.ids }),
    metric("OPPORTUNITIES", "opportunities.strong_prepared", "M23_JOBS", facts.opportunities.strongPrepared.value, facts.opportunities.strongActionable, facts.opportunities.strongActionable > 0 ? (facts.opportunities.strongPrepared.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", { ids: facts.opportunities.strongPrepared.ids }),
    metric("OPPORTUNITIES", "opportunities.ready_to_apply", "M23_JOBS", facts.opportunities.readyToApply.value, facts.opportunities.strongPrepared.value, facts.opportunities.strongPrepared.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.opportunities.readyToApply.ids }),
    metric("OPPORTUNITIES", "opportunities.handed_off", "M23_JOBS", facts.opportunities.handedOff.value, null, facts.opportunities.handedOff.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.opportunities.handedOff.ids }),
    metric("OPPORTUNITIES", "opportunities.expired_unacted", "M23_JOBS", facts.opportunities.expiredUnacted.value, facts.opportunities.strongActionable, facts.opportunities.strongActionable > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.opportunities.expiredUnacted.ids }),
    metric("RESUME", "resume.versions_created", "M21_RESUME", facts.resume.versionsCreated.value, null, "DATA_AVAILABLE", { ids: facts.resume.versionsCreated.ids }),
    metric("RESUME", "resume.revisions_created", "M21_RESUME", facts.resume.revisionsCreated.value, null, "DATA_AVAILABLE", { ids: facts.resume.revisionsCreated.ids }),
    metric("RESUME", "resume.ready", "M21_RESUME", facts.resume.ready.value, null, facts.resume.ready.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.resume.ready.ids, note: "Counted from RESUME_READY activity records only." }),
    metric("RESUME", "resume.used", "M21_RESUME", facts.resume.used.value, null, facts.resume.used.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.resume.used.ids, note: "Counted from applications submitted with a linked resume." }),
    metric("COMMUNICATION", "communication.created", "M24_COMMUNICATION", facts.communication.created.value, null, "DATA_AVAILABLE", { ids: facts.communication.created.ids }),
    metric("COMMUNICATION", "communication.used", "M24_COMMUNICATION", facts.communication.used.value, null, facts.communication.used.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.communication.used.ids }),
    metric("COMMUNICATION", "communication.followup_used", "M24_COMMUNICATION", facts.communication.followUpUsed.value, null, facts.communication.followUpUsed.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.communication.followUpUsed.ids }),
    metric("LINKEDIN", "linkedin.ready", "M25_LINKEDIN", facts.linkedin.ready.value, null, facts.preferences.includeLinkedIn ? (facts.linkedin.ready.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE") : "NOT_APPLICABLE", { ids: facts.linkedin.ready.ids }),
    metric("LINKEDIN", "linkedin.published", "M25_LINKEDIN", facts.linkedin.published.value, facts.linkedin.ready.value, facts.preferences.includeLinkedIn ? (facts.linkedin.ready.value + facts.linkedin.published.value > 0 ? (facts.linkedin.published.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE") : "NOT_APPLICABLE", { ids: facts.linkedin.published.ids }),
    metric("LINKEDIN", "linkedin.ready_unpublished", "M25_LINKEDIN", facts.linkedin.readyUnpublished.value, null, facts.preferences.includeLinkedIn ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.linkedin.readyUnpublished.ids }),
    metric("LINKEDIN", "linkedin.performance_snapshots", "M25_LINKEDIN", facts.linkedin.performanceSnapshots.value, null, facts.linkedin.performanceSnapshots.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE", { ids: facts.linkedin.performanceSnapshots.ids }),
    metric("SKILLS_EVIDENCE", "skills.completed_actions", "M26_DAILY", facts.skillsEvidence.skillActionsCompleted.value, facts.skillsEvidence.skillActionsPlanned, facts.preferences.includeSkillDevelopment ? (facts.skillsEvidence.skillActionsPlanned > 0 ? (facts.skillsEvidence.skillActionsCompleted.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE") : "NOT_APPLICABLE", { ids: facts.skillsEvidence.skillActionsCompleted.ids }),
    metric("SKILLS_EVIDENCE", "skills.evidence_actions", "M26_DAILY", facts.skillsEvidence.evidenceActionsCompleted.value, facts.skillsEvidence.skillActionsPlanned, facts.preferences.includeSkillDevelopment ? (facts.skillsEvidence.evidenceActionsCompleted.value > 0 ? "DATA_AVAILABLE" : "NOT_APPLICABLE") : "NOT_APPLICABLE", { ids: facts.skillsEvidence.evidenceActionsCompleted.ids }),
    metric("SKILLS_EVIDENCE", "skills.recurring_gaps_addressed", "M23_JOBS", facts.skillsEvidence.recurringGapsAddressed.value, facts.skillsEvidence.remainingGaps.length + facts.skillsEvidence.recurringGapsAddressed.value, facts.skillsEvidence.remainingGaps.length + facts.skillsEvidence.recurringGapsAddressed.value > 0 ? (facts.skillsEvidence.recurringGapsAddressed.value > 0 ? "DATA_AVAILABLE" : "NO_ACTIVITY") : "NOT_APPLICABLE", { remaining: facts.skillsEvidence.remainingGaps }),
  ];
}
