import { clampScore, priorityBandFromScore } from "../lib/views";
import type {
  DailyActionCandidate,
  PriorityEvidence,
  ScoredDailyActionCandidate,
} from "../types";

function clampPart(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function hasSignal(signals: string[], match: string): boolean {
  return signals.some((signal) => signal.toLowerCase().includes(match.toLowerCase()));
}

export function scoreDailyActionCandidate(
  candidate: DailyActionCandidate,
  nowFacts?: { localDate: string },
): ScoredDailyActionCandidate {
  void nowFacts;
  const facts = [...candidate.whyNowFacts];

  let urgency = 6;
  if (hasSignal(candidate.urgencySignals, "interview today") || hasSignal(candidate.urgencySignals, "assessment due today") || hasSignal(candidate.urgencySignals, "offer response due") || hasSignal(candidate.urgencySignals, "deadline today")) {
    urgency = 30;
  } else if (hasSignal(candidate.urgencySignals, "interview tomorrow")) {
    urgency = 26;
  } else if (hasSignal(candidate.urgencySignals, "follow-up overdue")) {
    urgency = 24;
  } else if (hasSignal(candidate.urgencySignals, "follow-up due today") || hasSignal(candidate.urgencySignals, "scheduled publish")) {
    urgency = 22;
  } else if (hasSignal(candidate.urgencySignals, "interview soon") || hasSignal(candidate.urgencySignals, "assessment soon")) {
    urgency = 20;
  } else if (candidate.type === "JOB_APPLY") {
    urgency = 14;
  } else if (candidate.type === "APPLICATION_FOLLOW_UP") {
    urgency = 16;
  } else if (candidate.type === "LINKEDIN_PUBLISH") {
    urgency = 12;
  }
  urgency = clampPart(urgency, 30);

  let careerImpact = 8;
  if (candidate.type === "INTERVIEW_PREP" || candidate.type === "ASSESSMENT_PREP") careerImpact = 25;
  else if (candidate.type === "JOB_APPLY" || candidate.type === "APPLICATION_NEXT_STEP") careerImpact = 22;
  else if (candidate.type === "JOB_PREPARE" || candidate.type === "RESUME_REVIEW") careerImpact = 18;
  else if (candidate.type === "APPLICATION_FOLLOW_UP" || candidate.type === "COMMUNICATION_REVIEW") careerImpact = 16;
  else if (candidate.type === "EVIDENCE_BUILDING" || candidate.type === "SKILL_DEVELOPMENT") careerImpact = 15;
  else if (candidate.type === "LINKEDIN_PUBLISH" || candidate.type === "PROFILE_IMPROVEMENT") careerImpact = 14;
  else if (candidate.type === "LINKEDIN_POST_REVIEW") careerImpact = 12;
  else if (candidate.type === "JOB_REVIEW") careerImpact = 10;
  if (hasSignal(candidate.impactSignals, "evidence gap")) careerImpact = Math.max(careerImpact, 16);
  careerImpact = clampPart(careerImpact, 25);

  let readiness = candidate.isActionable ? 15 : 0;
  if (candidate.blockedReason && candidate.type !== "LINKEDIN_RECONNECT") readiness = 0;
  if (candidate.type === "LINKEDIN_RECONNECT") readiness = 15;
  if (!candidate.isActionable) readiness = 0;
  readiness = clampPart(readiness, 15);

  let opportunityQuality = 6;
  const suitabilitySignal = candidate.opportunityQualitySignals.find((signal) => signal.includes("suitability"));
  if (suitabilitySignal) {
    const score = Number(suitabilitySignal.replace(/[^\d]/g, ""));
    if (Number.isFinite(score)) opportunityQuality = clampPart(Math.round((score / 100) * 15), 15);
  } else if (candidate.contextSnapshot.finalScore && typeof candidate.contextSnapshot.finalScore === "number") {
    opportunityQuality = clampPart(Math.round((candidate.contextSnapshot.finalScore / 100) * 15), 15);
  } else if (candidate.contextSnapshot.opportunityScore && typeof candidate.contextSnapshot.opportunityScore === "number") {
    opportunityQuality = clampPart(Math.round((candidate.contextSnapshot.opportunityScore / 100) * 15), 15);
  } else if (candidate.type === "INTERVIEW_PREP" || candidate.type === "ASSESSMENT_PREP") {
    opportunityQuality = 14;
  } else if (candidate.type === "LINKEDIN_PUBLISH") {
    opportunityQuality = 10;
  }
  opportunityQuality = clampPart(opportunityQuality, 15);

  let momentumNeglect = 3;
  if (hasSignal(candidate.neglectSignals, "neglected") || hasSignal(candidate.urgencySignals, "follow-up overdue")) {
    momentumNeglect = 10;
  } else if (candidate.type === "EVIDENCE_BUILDING" || candidate.type === "PROFILE_IMPROVEMENT") {
    momentumNeglect = 7;
  } else if (candidate.type === "JOB_REVIEW") {
    momentumNeglect = 4;
  }
  momentumNeglect = clampPart(momentumNeglect, 10);

  let effortEfficiency = 3;
  if (candidate.estimatedMinutes <= 10) effortEfficiency = 5;
  else if (candidate.estimatedMinutes <= 15) effortEfficiency = 4;
  else if (candidate.estimatedMinutes <= 30) effortEfficiency = 3;
  else if (candidate.estimatedMinutes <= 60) effortEfficiency = 2;
  else effortEfficiency = 1;
  effortEfficiency = clampPart(effortEfficiency, 5);

  const hardOverride =
    hasSignal(candidate.urgencySignals, "interview today") ||
    hasSignal(candidate.urgencySignals, "interview tomorrow") ||
    hasSignal(candidate.urgencySignals, "assessment due today") ||
    hasSignal(candidate.urgencySignals, "offer response due") ||
    hasSignal(candidate.urgencySignals, "deadline today");
  const hardOverrideReason = hardOverride
    ? candidate.urgencySignals.find((signal) =>
        /interview today|interview tomorrow|assessment due today|offer response due|deadline today/i.test(signal),
      ) ?? "same-day hard deadline"
    : null;

  let total = urgency + careerImpact + readiness + opportunityQuality + momentumNeglect + effortEfficiency;
  if (hardOverride) total = Math.max(total, 85);
  const memoryBonus = Math.max(0, Math.min(5, Number(candidate.contextSnapshot.memoryBonus) || 0));
  if (!hardOverride && memoryBonus > 0) total += memoryBonus;
  total = clampScore(total);

  const priority: PriorityEvidence = {
    components: {
      urgency,
      careerImpact,
      readiness,
      opportunityQuality,
      momentumNeglect,
      effortEfficiency,
    },
    total,
    band: priorityBandFromScore(total),
    hardOverride,
    hardOverrideReason,
    facts,
  };

  return { ...candidate, priority };
}

export function scoreCandidates(
  candidates: DailyActionCandidate[],
  localDate: string,
): ScoredDailyActionCandidate[] {
  return candidates
    .map((candidate) => scoreDailyActionCandidate(candidate, { localDate }))
    .sort((a, b) => {
      if (b.priority.total !== a.priority.total) return b.priority.total - a.priority.total;
      return a.fingerprint.localeCompare(b.fingerprint);
    });
}
