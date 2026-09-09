"use client";

import type { ExecutionSessionView } from "../types";

export function FinalApplicationReview({ view }: { view: ExecutionSessionView }) {
  if (!view.review) return null;
  return (
    <section className="surface-glass p-4">
      <p className="section-eyebrow">Final review</p>
      <dl className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
        <div>Required fields {view.review.requiredComplete} / {view.review.requiredTotal}</div>
        <div>Resume Revision {view.review.resumeRevisionNumber ?? view.review.resumeRevisionId ?? "—"} {view.review.resumeHashVerified ? "· hash verified" : ""}</div>
        <div>Cover letter Revision {view.review.coverLetterRevisionNumber ?? view.review.coverLetterRevisionId ?? "Not required"}</div>
        <div>Career facts verified {view.review.careerFactsVerified}</div>
        <div>Legal confirmed {view.review.legalConfirmed}</div>
        <div>AI answers reviewed {view.review.aiReviewed}</div>
        <div>Consent {view.review.consentConfirmed ? "Confirmed" : "Pending"}</div>
        <div>Unresolved {view.review.unresolved.length}</div>
      </dl>
      {view.review.unresolved.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm">
          {view.review.unresolved.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
