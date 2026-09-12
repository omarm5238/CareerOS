import { prisma } from "@/server/db/prisma";

import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import type { ExecutionProgressCategory, ExecutionSessionView, FinalReviewView, RuntimeSubmissionCapability } from "../types";
import { loadOwnedSession, sessionJson } from "./load-owned-session";
import { buildFinalReview } from "../submission/build-final-submission-snapshot";

function confirmedSubmitMessage(runtime: RuntimeSubmissionCapability | null): string {
  if (runtime?.confirmedBrowserSubmit) {
    return "CareerOS can submit this application after your approval.";
  }
  return "CareerOS can assist with this application, but final submission must be completed manually.";
}

export async function getExecutionSession(userId: string, sessionId: string): Promise<ExecutionSessionView> {
  const row = await loadOwnedSession(userId, sessionId);
  const { snapshot, plan, pending, warnings } = sessionJson(row);
  const connected = getApplicationBrowserRunner().isAlive(sessionId);
  let currentDomain: string | null = null;
  if (row.currentUrl) {
    try {
      currentDomain = new URL(row.currentUrl).hostname;
    } catch {
      currentDomain = null;
    }
  }
  const runtime = plan.runtimeCapability ?? null;
  const confirmed = Boolean(runtime?.confirmedBrowserSubmit) && row.status === "READY_TO_SUBMIT";
  const latestAttempt = row.submissionAttempts[0] ?? null;
  const review = snapshot ? buildFinalReview(row, snapshot, plan) : null;
  if (review?.resumeRevisionId) {
    const revision = await prisma.resumeVersionRevision.findFirst({
      where: { id: review.resumeRevisionId, userId },
      select: { revisionNumber: true },
    });
    review.resumeRevisionNumber = revision?.revisionNumber ?? null;
  }
  if (review?.coverLetterRevisionId) {
    const revision = await prisma.communicationDraftRevision.findFirst({
      where: { id: review.coverLetterRevisionId, userId },
      select: { revisionNumber: true },
    });
    review.coverLetterRevisionNumber = revision?.revisionNumber ?? null;
  }

  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    executionMode: row.executionMode,
    adapterVersion: row.adapterVersion,
    detectionConfidence: plan.detectionConfidence ?? null,
    jobTitle: row.jobPosting.title,
    company: row.jobPosting.company,
    currentUrl: row.currentUrl,
    currentDomain,
    currentStep: row.currentStep,
    totalSteps: row.totalSteps,
    browserConnected: connected,
    formFingerprint: row.formFingerprint,
    progress: progressFrom(snapshot, plan, row.status),
    pendingActions: pending,
    warnings,
    fields: (snapshot?.fields ?? []).map((field) => {
      const answer = plan.answers.find((item) => item.fieldId === field.externalId);
      return {
        id: field.externalId,
        label: field.label,
        classification: field.classification,
        required: field.required,
        status: answer?.status ?? "NEEDS_INPUT",
        confirmed: Boolean(answer?.confirmed),
        reviewed: Boolean(answer?.reviewed),
        proposedValue:
          field.classification === "SENSITIVE" || field.classification === "LEGAL"
            ? answer?.confirmed
              ? "Confirmed"
              : answer?.originalGeneratedValue
                ? "Previous answer available"
                : null
            : typeof answer?.value === "string"
              ? answer.value
              : null,
        originalGeneratedValue: answer?.originalGeneratedValue ?? null,
        previousAnswerAvailable: Boolean(answer?.originalGeneratedValue),
      };
    }),
    review,
    submission: {
      attemptId: latestAttempt?.id ?? null,
      status: latestAttempt?.status ?? null,
      verificationStatus: latestAttempt?.verificationStatus ?? null,
      method: latestAttempt?.method ?? null,
      confirmedBrowserSubmitAvailable: confirmed,
      confirmedBrowserSubmitMessage: confirmedSubmitMessage(runtime),
      runtimeCapability: runtime,
      resumeRevisionId: latestAttempt?.resumeVersionRevisionId ?? plan.uploadedDocuments.find((item) => item.kind === "resume")?.revisionId ?? null,
      resumeFileHash: latestAttempt?.resumeFileHash ?? plan.uploadedDocuments.find((item) => item.kind === "resume")?.fileHash ?? null,
      coverLetterRevisionId: latestAttempt?.coverLetterRevisionId ?? plan.uploadedDocuments.find((item) => item.kind === "cover_letter")?.revisionId ?? null,
      coverLetterFileHash: latestAttempt?.coverLetterFileHash ?? plan.uploadedDocuments.find((item) => item.kind === "cover_letter")?.fileHash ?? null,
      submittedAt: latestAttempt?.submittedAt?.toISOString() ?? null,
      verifiedAt: latestAttempt?.verifiedAt?.toISOString() ?? null,
    },
    applicationStatus: row.application.status,
    packageStatus: row.applicationPackage.status,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    events: row.events.map((event) => ({ type: event.type, message: event.message, createdAt: event.createdAt.toISOString() })),
  };
}

function progressFrom(
  snapshot: ReturnType<typeof sessionJson>["snapshot"],
  plan: ReturnType<typeof sessionJson>["plan"],
  status: string,
): ExecutionProgressCategory[] {
  const fields = snapshot?.fields ?? [];
  const group = (classification: string, label: string): ExecutionProgressCategory => {
    const items = fields.filter((field) => field.classification === classification);
    if (items.length === 0) return { key: classification, label, state: "not_present", countLabel: null };
    const resolved = items.filter((field) => {
      const answer = plan.answers.find((item) => item.fieldId === field.externalId);
      if (classification === "LEGAL" || classification === "CONSENT" || classification === "SENSITIVE") return Boolean(answer?.confirmed);
      if (classification === "FREE_TEXT") return Boolean(answer?.reviewed);
      if (classification === "DOCUMENT") return plan.uploadedDocuments.some((doc) => doc.fieldId === field.externalId);
      return answer?.status === "AUTO_FILL" || Boolean(answer?.confirmed) || (!field.required && answer?.status === "OPTIONAL_EMPTY");
    });
    const needs = resolved.length < items.length;
    return {
      key: classification,
      label,
      state: needs ? "needs_you" : "complete",
      countLabel: `${resolved.length}/${items.length}`,
    };
  };
  return [
    group("IDENTITY", "Personal details"),
    group("CONTACT", "Contact"),
    group("DOCUMENT", "Resume / Cover Letter"),
    group("CAREER_FACT", "Career questions"),
    group("LEGAL", "Legal"),
    group("SENSITIVE", "Sensitive"),
    group("CONSENT", "Consent"),
    {
      key: "REVIEW",
      label: "Final review",
      state: status === "READY_FOR_REVIEW" || status === "READY_TO_SUBMIT" || status === "SUBMITTED" ? "complete" : "pending",
      countLabel: null,
    },
  ];
}

export type { FinalReviewView };
