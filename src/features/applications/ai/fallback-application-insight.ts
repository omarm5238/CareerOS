import type { ApplicationNextActionType } from "@/generated/prisma/client";

import type {
  ApplicationNextActionContent,
  ApplicationRejectionAnalysis,
  ApplicationStagePrep,
} from "../types";
import type { ApplicationAiContext } from "./types";

const FALLBACK_WARNING =
  "AI preparation is unavailable, so this is a conservative rule-based draft built from your stored CareerOS data.";

function topMissingSkills(context: ApplicationAiContext, limit = 5): string[] {
  return context.job.missingSkills.slice(0, limit);
}

function resumeLabel(context: ApplicationAiContext): string {
  if (!context.resume.resumeVersionTitle) {
    return "No CareerOS resume revision is recorded for this application";
  }
  return `${context.resume.resumeVersionTitle} · Revision ${
    context.resume.revisionNumber ?? "?"
  }`;
}

/** Deterministic next action derived only from status and recorded dates. */
export function buildFallbackNextAction(
  context: ApplicationAiContext,
): ApplicationNextActionContent {
  const missing = topMissingSkills(context, 3);
  const now = new Date();

  const plans: Record<
    string,
    { type: ApplicationNextActionType; title: string; reason: string; days: number | null }
  > = {
    DRAFT: {
      type: "SUBMIT_APPLICATION",
      title: "Submit this application",
      reason:
        "The application is prepared but has not been submitted yet. Mark it applied once you have actually sent it.",
      days: 0,
    },
    APPLIED: {
      type: "FOLLOW_UP",
      title: "Monitor the application and schedule a follow-up",
      reason:
        context.daysSinceApplied !== null
          ? `Submitted ${context.daysSinceApplied} days ago with no recorded reply. A short, polite follow-up keeps the application visible.`
          : "Keep an eye on this application and schedule a follow-up if you do not hear back.",
      days: 7,
    },
    SCREENING: {
      type: "PREPARE_SCREENING",
      title: "Prepare a concise pitch for the screening call",
      reason:
        "Review the role requirements and prepare a short, concrete explanation of your most relevant experience.",
      days: 2,
    },
    ASSESSMENT: {
      type: "PREPARE_ASSESSMENT",
      title: "Focus preparation on the highest-priority gaps",
      reason:
        missing.length > 0
          ? `The job analysis flags ${missing.join(", ")} as the weakest areas against this role.`
          : "Focus preparation on the technical areas the job description emphasises.",
      days: 2,
    },
    INTERVIEW: {
      type: "PREPARE_INTERVIEW",
      title: "Prepare evidence that maps to the strongest job requirements",
      reason: `Bring concrete examples from ${resumeLabel(context)} that directly match what this role asks for.`,
      days: 2,
    },
    OFFER: {
      type: "REVIEW_OFFER",
      title: "Review compensation, conditions and start date",
      reason:
        "Check the offer terms, responsibilities, start date and any required documents before responding.",
      days: 3,
    },
    REJECTED: {
      type: "REVIEW_REJECTION",
      title: "Review this rejection",
      reason:
        "Compare the job requirements against the exact resume revision you submitted, and record any confirmed reason the employer gave.",
      days: null,
    },
    ACCEPTED: {
      type: "PROVIDE_DOCUMENTS",
      title: "Confirm onboarding documents",
      reason: "Check which documents and conditions still need to be provided.",
      days: null,
    },
    WITHDRAWN: {
      type: "WAIT",
      title: "No further action needed",
      reason: "You withdrew from this process, so no next step is required.",
      days: null,
    },
  };

  const plan = plans[context.status] ?? plans.APPLIED;

  let dueAt: string | null = null;
  if (plan.days !== null) {
    const due = new Date(now);
    due.setDate(due.getDate() + plan.days);
    dueAt = due.toISOString();
  }

  const evidence: string[] = [];
  if (context.job.matchScore !== null) {
    evidence.push(`CareerOS match score for this role is ${context.job.matchScore}/100.`);
  }
  if (context.resume.resumeVersionTitle) {
    evidence.push(`Submitted resume: ${resumeLabel(context)}.`);
  }
  if (missing.length > 0) {
    evidence.push(`Requirements without strong resume evidence: ${missing.join(", ")}.`);
  }

  return {
    type: plan.type,
    title: plan.title,
    reason: plan.reason,
    priority: context.status === "OFFER" || context.status === "DRAFT" ? "high" : "medium",
    dueAt,
    evidence,
    warnings: [FALLBACK_WARNING],
  };
}

export function buildFallbackStagePrep(
  context: ApplicationAiContext,
  stage: ApplicationStagePrep["stage"],
): ApplicationStagePrep {
  const missing = topMissingSkills(context, 6);
  const matched = context.job.matchedSkills.slice(0, 6);
  const evidence = [
    ...context.resume.experienceBullets.slice(0, 4),
    ...context.resume.projects.slice(0, 2),
  ];

  const summaries: Record<ApplicationStagePrep["stage"], string> = {
    SCREENING: `Prepare a concise explanation of your most relevant experience for ${
      context.job.title ?? "this role"
    }. Screening usually confirms basics, motivation and availability rather than deep technical detail.`,
    ASSESSMENT: `Focus your preparation on the technical areas this role emphasises. The job analysis highlights the largest gaps between your resume and the requirements.`,
    INTERVIEW: `Prepare concrete evidence from ${resumeLabel(
      context,
    )} that maps directly onto the strongest requirements in this job description.`,
    OFFER: `Review the offer terms carefully before responding. CareerOS does not hold salary benchmark data, so compensation judgements are yours to make.`,
  };

  const checklists: Record<ApplicationStagePrep["stage"], string[]> = {
    SCREENING: [
      "Re-read the job description and note the three requirements you match most strongly.",
      "Prepare a 60-second summary of your background aimed at this role.",
      "Be ready to state your availability and notice period.",
    ],
    ASSESSMENT: [
      "Re-read the job description for the exact technologies named.",
      "Practise the weakest areas listed below before attempting the task.",
      "Confirm the assessment format and deadline with your contact.",
    ],
    INTERVIEW: [
      "Prepare one concrete story for each of your strongest matching skills.",
      "Review the exact resume revision you submitted so your answers stay consistent with it.",
      "Prepare questions to ask about the team and the role.",
    ],
    OFFER: [
      "Confirm base compensation, any variable component and benefits in writing.",
      "Check the start date, notice period and probation terms.",
      "Confirm which documents the employer still needs from you.",
    ],
  };

  const questionsToAsk: Record<ApplicationStagePrep["stage"], string[]> = {
    SCREENING: [
      "What does the interview process look like from here?",
      "What would success in the first three months look like?",
    ],
    ASSESSMENT: [
      "How much time should the assessment take?",
      "What will you be evaluating most closely?",
    ],
    INTERVIEW: [
      "How is the team structured, and where would this role sit?",
      "What are the biggest technical challenges the team faces right now?",
    ],
    OFFER: [
      "Can you confirm the full compensation breakdown in writing?",
      "What is the expected start date and onboarding plan?",
    ],
  };

  const risks: string[] = [];
  if (missing.length > 0) {
    risks.push(
      `The job asks for ${missing.join(", ")} and your submitted resume has limited or no evidence for these.`,
    );
  }
  if (context.resume.unsupportedKeywords.length > 0) {
    risks.push(
      `Be careful discussing ${context.resume.unsupportedKeywords
        .slice(0, 4)
        .join(", ")} — your resume evidence for these is weak.`,
    );
  }
  if (!context.resume.available && !context.resume.resumeVersionTitle) {
    risks.push("No CareerOS resume revision is recorded, so this preparation is based on the job only.");
  }

  return {
    stage,
    summary: summaries[stage],
    focusAreas: stage === "OFFER" ? ["Compensation", "Conditions", "Start date", "Documents"] : matched,
    likelyQuestions: [],
    evidenceToEmphasize: stage === "OFFER" ? [] : evidence,
    risks,
    questionsToAsk: questionsToAsk[stage],
    checklist: checklists[stage],
    warnings: [FALLBACK_WARNING],
  };
}

/**
 * Rule-based rejection review. It only ever restates the confirmed fact and
 * frames everything else as an explicit, low-confidence hypothesis.
 */
export function buildFallbackRejectionAnalysis(
  context: ApplicationAiContext,
): ApplicationRejectionAnalysis {
  const missing = topMissingSkills(context, 5);

  const likelyFactors = missing.map((skill) => ({
    factor: `Limited evidence for ${skill}`,
    evidence: `The job analysis lists ${skill} as a requirement, and the submitted resume revision does not show strong evidence for it.`,
    confidence: "low" as const,
  }));

  const warnings = [
    FALLBACK_WARNING,
    "These are hypotheses generated from your stored job and resume data. They are not reasons the employer gave.",
  ];

  if (!context.confirmedRejectionReason) {
    warnings.push("No confirmed rejection reason was recorded for this application.");
  }

  return {
    confirmedReason: context.confirmedRejectionReason,
    likelyFactors,
    whatWorked:
      context.job.matchedSkills.length > 0
        ? [`Your resume matched ${context.job.matchedSkills.slice(0, 5).join(", ")} for this role.`]
        : [],
    lessons: [
      "Compare the job requirements against the exact resume revision you submitted.",
      "Record any reason the employer actually stated so future analysis has real facts to work with.",
    ],
    resumeChanges:
      missing.length > 0
        ? [`Only add ${missing.slice(0, 3).join(", ")} to your resume once you have real evidence for them.`]
        : [],
    skillActions: missing.slice(0, 3).map((skill) => `Build demonstrable evidence for ${skill}.`),
    nextActions: [
      "Review the job requirements against your resume evidence.",
      "Apply the lessons to your next tailored resume version.",
    ],
    warnings,
  };
}
