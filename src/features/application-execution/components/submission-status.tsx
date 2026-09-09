"use client";

import type { ExecutionSessionView } from "../types";

export function SubmissionStatus({
  view,
  onApproveSubmit,
  onVerify,
  onConfirm,
}: {
  view: ExecutionSessionView;
  onApproveSubmit: () => void;
  onVerify: () => void;
  onConfirm: (outcome: "SUBMITTED" | "NOT_SUBMITTED" | "NOT_SURE") => void;
}) {
  const verification = view.submission.verificationStatus;
  const dedicated = view.provider !== "GENERIC" && view.provider !== "UNKNOWN";

  return (
    <section className="surface-glass p-4">
      <p className="section-eyebrow">Submission</p>
      {view.status === "SUBMITTED" && verification === "VERIFIED" ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-medium text-[var(--color-text-primary)]">Application Submitted</p>
          <p>Verification: Verified by {view.provider} adapter</p>
          <p>M22 Application: {view.applicationStatus}</p>
          <p>Resume: {view.submission.resumeRevisionId}</p>
          <p>Submitted: {view.submission.submittedAt}</p>
        </div>
      ) : null}

      {view.status === "VERIFYING" || view.submission.status === "UNCERTAIN" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>CareerOS is checking whether the first submission succeeded. Do not try again yet.</p>
          <button className="btn-primary w-full" onClick={onVerify} type="button">
            Verify Again
          </button>
        </div>
      ) : null}

      {(verification === "PROBABLE" || verification === "UNVERIFIED") && view.applicationStatus === "DRAFT" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>CareerOS could not verify the result confidently. Did the submission complete?</p>
          <button className="btn-primary w-full" onClick={() => onConfirm("SUBMITTED")} type="button">
            Yes, it submitted
          </button>
          <button className="btn-secondary w-full" onClick={() => onConfirm("NOT_SUBMITTED")} type="button">
            No
          </button>
          <button className="btn-secondary w-full" onClick={() => onConfirm("NOT_SURE")} type="button">
            I&apos;m not sure
          </button>
        </div>
      ) : null}

      {dedicated && (view.status === "READY_TO_SUBMIT" || view.status === "READY_FOR_REVIEW") && view.review && view.review.unresolved.length === 0 ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            CareerOS will submit this specific application only.
          </p>
          <button className="btn-primary w-full" onClick={onApproveSubmit} type="button">
            Submit This Application Now
          </button>
        </div>
      ) : null}

      {!dedicated && view.status === "READY_FOR_REVIEW" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>Application ready for manual submission. CareerOS filled the supported fields. Review the external browser and submit manually.</p>
          <button className="btn-primary w-full" onClick={() => onConfirm("SUBMITTED")} type="button">
            I&apos;ve Submitted It
          </button>
          <button className="btn-secondary w-full" onClick={() => onConfirm("NOT_SUBMITTED")} type="button">
            Not Submitted
          </button>
        </div>
      ) : null}
    </section>
  );
}
