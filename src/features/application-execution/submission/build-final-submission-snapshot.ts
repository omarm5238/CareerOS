import { createHash } from "node:crypto";

import type { applicationExecutionSession, applicationPackage } from "@/generated/prisma/client";

import { adapterSupportsConfirmedSubmit } from "../adapters/adapter-registry";
import { hashValue } from "../form/form-fingerprint";
import type { ApplicationFormSnapshot, FillPlan, FinalReviewView, FinalSubmissionSnapshot } from "../types";
import { ExecutionAccessError } from "../lib/permissions";

type SessionRow = applicationExecutionSession & { applicationPackage: applicationPackage };

export function buildFinalSubmissionSnapshot(
  row: SessionRow,
  snapshot: ApplicationFormSnapshot,
  plan: FillPlan,
): FinalSubmissionSnapshot {
  const resume = plan.uploadedDocuments.find((item) => item.kind === "resume");
  const cover = plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
  return {
    applicationPackageId: row.applicationPackageId,
    packageVersion: row.applicationPackage.version,
    applicationId: row.applicationId,
    jobPostingId: row.jobPostingId,
    provider: row.provider,
    adapterVersion: row.adapterVersion,
    formFingerprint: row.formFingerprint ?? "",
    fields: snapshot.fields.map((field) => {
      const answer = plan.answers.find((item) => item.fieldId === field.externalId);
      const raw =
        field.classification === "SENSITIVE" || field.classification === "LEGAL"
          ? answer?.confirmed
            ? "confirmed"
            : ""
          : answer?.value ?? "";
      return {
        fieldId: field.externalId,
        normalizedLabel: field.normalizedLabel,
        classification: field.classification,
        valueFingerprint: hashValue(typeof raw === "boolean" ? raw : String(raw)),
        source: answer?.source ?? null,
        confirmed: Boolean(answer?.confirmed || answer?.reviewed || answer?.status === "AUTO_FILL"),
      };
    }),
    resumeRevisionId: resume?.revisionId ?? row.applicationPackage.resumeVersionRevisionId ?? "",
    resumeFileHash: resume?.fileHash ?? "",
    coverLetterRevisionId: cover?.revisionId ?? row.applicationPackage.coverLetterRevisionId ?? null,
    coverLetterFileHash: cover?.fileHash ?? null,
    consentConfirmations: plan.answers.filter((item) => item.classification === "CONSENT" && item.confirmed).map((item) => item.fieldId),
  };
}

export function submissionFingerprint(snapshot: FinalSubmissionSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function buildFinalReview(row: SessionRow, snapshot: ApplicationFormSnapshot, plan: FillPlan): FinalReviewView {
  const required = snapshot.fields.filter((field) => field.required);
  const requiredComplete = required.filter((field) => {
    const answer = plan.answers.find((item) => item.fieldId === field.externalId);
    if (!answer) return false;
    if (field.classification === "LEGAL" || field.classification === "CONSENT" || field.classification === "SENSITIVE") return answer.confirmed;
    if (field.classification === "FREE_TEXT") return answer.reviewed;
    if (field.classification === "DOCUMENT") return plan.uploadedDocuments.some((doc) => doc.fieldId === field.externalId);
    return answer.status === "AUTO_FILL" || answer.confirmed || Boolean(answer.value);
  }).length;
  const unresolved: string[] = [];
  const groups = { verified: [] as string[], needsReview: [] as string[], needsInput: [] as string[], optional: [] as string[] };
  for (const field of snapshot.fields) {
    const answer = plan.answers.find((item) => item.fieldId === field.externalId);
    if (!field.required && field.classification !== "LEGAL" && field.classification !== "CONSENT") {
      groups.optional.push(field.label);
      continue;
    }
    if (answer?.status === "REVIEW_REQUIRED" || (field.classification === "FREE_TEXT" && !answer?.reviewed)) {
      groups.needsReview.push(field.label);
      unresolved.push(field.label);
    } else if (!answer || answer.status === "NEEDS_INPUT" || answer.status === "BLOCKED" || ((field.classification === "LEGAL" || field.classification === "CONSENT") && !answer.confirmed)) {
      groups.needsInput.push(field.label);
      unresolved.push(field.label);
    } else {
      groups.verified.push(field.label);
    }
  }
  return {
    requiredComplete,
    requiredTotal: required.length,
    resumeRevisionNumber: null,
    resumeRevisionId: plan.uploadedDocuments.find((item) => item.kind === "resume")?.revisionId ?? row.applicationPackage.resumeVersionRevisionId,
    resumeHashVerified: Boolean(plan.uploadedDocuments.find((item) => item.kind === "resume")?.fileHash),
    coverLetterRevisionNumber: null,
    coverLetterRevisionId: plan.uploadedDocuments.find((item) => item.kind === "cover_letter")?.revisionId ?? row.applicationPackage.coverLetterRevisionId ?? null,
    careerFactsVerified: snapshot.fields.filter((field) => field.classification === "CAREER_FACT" && plan.answers.find((item) => item.fieldId === field.externalId)?.status === "AUTO_FILL").length,
    legalConfirmed: plan.answers.filter((item) => item.classification === "LEGAL" && item.confirmed).length,
    aiReviewed: plan.answers.filter((item) => item.classification === "FREE_TEXT" && item.reviewed).length,
    consentConfirmed: plan.answers.filter((item) => item.classification === "CONSENT").every((item) => item.confirmed) && plan.answers.some((item) => item.classification === "CONSENT"),
    unresolved,
    groups,
  };
}

export function assertReadyToSubmit(row: SessionRow, snapshot: ApplicationFormSnapshot, plan: FillPlan, drifted: boolean) {
  if (row.applicationPackage.status !== "APPROVED" && row.applicationPackage.status !== "SUBMISSION_STARTED") {
    throw new ExecutionAccessError("CONFLICT", "Package is not approved.");
  }
  const review = buildFinalReview(row, snapshot, plan);
  if (review.unresolved.length > 0) {
    throw new ExecutionAccessError("CONFLICT", "Required fields are still unresolved.");
  }
  if (!adapterSupportsConfirmedSubmit(row.provider, drifted)) {
    throw new ExecutionAccessError("CONFLICT", "This adapter does not support confirmed browser submit. Submit manually in the application browser.");
  }
  if (!snapshot.submitControl?.isFinal || snapshot.submitControl.confidence < 0.8) {
    throw new ExecutionAccessError("CONFLICT", "No trusted final submit control is available.");
  }
  if (!plan.uploadedDocuments.some((item) => item.kind === "resume")) {
    throw new ExecutionAccessError("CONFLICT", "Exact approved resume has not been uploaded.");
  }
}
