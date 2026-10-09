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

      {view.submission.status === "UNCERTAIN" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="font-medium text-[var(--color-text-primary)]">Submission status uncertain.</p>
          <p>
            CareerOS cannot safely retry automatically because the provider may already have received the application.
            Verify on the provider before retrying.
          </p>
          <p>Manual verification required. Nothing is marked applied until you confirm the provider accepted it.</p>
          <button className="btn-primary w-full" onClick={() => onConfirm("SUBMITTED")} type="button">
            I verified this was submitted
          </button>
          <button className="btn-secondary w-full" onClick={() => onConfirm("NOT_SUBMITTED")} type="button">
            It was not submitted
          </button>
        </div>
      ) : null}

      {view.status === "FAILED" && view.failureCode !== "SUBMISSION_REJECTED" && view.failureCode !== "SUBMISSION_UNCERTAIN" ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-medium text-[var(--color-text-primary)]">Nothing was submitted.</p>
          <p>The attempt failed before a confirmed submission. Retry may be available after you review the package again.</p>
        </div>
      ) : null}

      {view.status === "FAILED" && view.failureCode === "SUBMISSION_REJECTED" ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-medium text-[var(--color-text-primary)]">The provider rejected this application.</p>
          <p>This is not an uncertain submission. CareerOS will not submit it again automatically.</p>
        </div>
      ) : null}

      {view.status === "VERIFYING" && view.submission.status !== "UNCERTAIN" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>CareerOS is checking whether the submission succeeded. Do not submit again yet.</p>
          <button className="btn-secondary w-full" onClick={onVerify} type="button">
            Check confirmation
          </button>
        </div>
      ) : null}

      {(verification === "PROBABLE" || verification === "UNVERIFIED") && view.applicationStatus === "DRAFT" && view.submission.status !== "UNCERTAIN" ? (
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

      {view.submission.confirmedBrowserSubmitAvailable && view.status === "READY_TO_SUBMIT" && view.review && view.review.unresolved.length === 0 ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {view.submission.confirmedBrowserSubmitMessage}
          </p>
          <button className="btn-primary w-full" onClick={onApproveSubmit} type="button">
            Submit This Application Now
          </button>
        </div>
      ) : null}

      {dedicated && !view.submission.confirmedBrowserSubmitAvailable && (view.status === "READY_TO_SUBMIT" || view.status === "READY_FOR_REVIEW") && view.review && view.review.unresolved.length === 0 ? (
        <div className="mt-3 space-y-3 text-sm text-[var(--color-text-secondary)]">
          <p>{view.submission.confirmedBrowserSubmitMessage}</p>
          <button className="btn-primary w-full" onClick={() => onConfirm("SUBMITTED")} type="button">
            I&apos;ve Submitted It
          </button>
          <button className="btn-secondary w-full" onClick={() => onConfirm("NOT_SUBMITTED")} type="button">
            Not Submitted
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
