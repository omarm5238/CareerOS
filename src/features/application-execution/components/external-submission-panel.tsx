"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { SubmissionAuditView } from "@/features/application-execution/integrity/external-submission";

export function ExternalSubmissionPanel({
  applicationId,
  audit,
}: {
  applicationId: string;
  audit: SubmissionAuditView;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function post(action: string, path: string, body: Record<string, unknown>) {
    setPending(action);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setMessage(payload.message ?? "Request failed.");
        return;
      }
      if (action === "retry") setMessage("A new one-time authorization was issued.");
      if (action === "verify") setMessage("Provider verification did not submit the application.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="surface-glass p-5" data-hydrated={hydrated ? "true" : "false"} data-testid="external-submission" id="external-submission">
      <p className="section-eyebrow">External submission</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Submission execution</h2>
      {audit.attemptId ? (
        <dl className="mt-4 space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          <div>
            <dt className="font-medium text-[var(--color-text-primary)]">Package</dt>
            <dd data-testid="external-package">{audit.packageHash ? audit.packageHash.slice(0, 12) : audit.packageId}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-text-primary)]">Provider</dt>
            <dd data-testid="external-provider">{audit.provider ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-text-primary)]">Execution state</dt>
            <dd data-testid="external-phase">{audit.phase ?? "Not started"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-text-primary)]">Confirmation</dt>
            <dd data-testid="external-confirmation">
              {audit.confirmationStrength ?? "NONE"}
              {audit.confirmationType ? ` · ${audit.confirmationType}` : ""}
            </dd>
          </div>
          {audit.providerReference ? (
            <div>
              <dt className="font-medium text-[var(--color-text-primary)]">Provider reference</dt>
              <dd data-testid="external-reference">{audit.providerReference}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-[var(--color-text-primary)]">Recovery</dt>
            <dd data-testid="external-recovery">{audit.recoveryDisposition ?? "Not classified"}</dd>
          </div>
          {audit.adapterVersion ? (
            <div>
              <dt className="font-medium text-[var(--color-text-primary)]">Adapter evidence</dt>
              <dd data-testid="external-adapter">
                {audit.adapterVersion} · {audit.selectorStrategyVersion} · {audit.confirmationStrategyVersion}
              </dd>
            </div>
          ) : null}
          {audit.verificationResult ? (
            <div>
              <dt className="font-medium text-[var(--color-text-primary)]">Verification</dt>
              <dd data-testid="external-verification">{audit.verificationResult}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">No external submission has started.</p>
      )}

      {audit.uncertain ? (
        <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--color-text-primary)]" data-testid="external-uncertain">
          <p>The submit action may have reached the employer.</p>
          <p>CareerOS will not submit this application again automatically.</p>
        </div>
      ) : null}

      {audit.attemptId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {audit.canVerify ? (
            <button
              className="btn-secondary"
              disabled={pending !== null}
              onClick={() =>
                void post("verify", `/api/applications/${applicationId}/submission/verify`, { attemptId: audit.attemptId })
              }
              type="button"
            >
              Verify submission
            </button>
          ) : null}
          {audit.requiresManualReview ? (
            <>
              <button
                className="btn-secondary"
                disabled={pending !== null}
                onClick={() =>
                  void post("submitted", `/api/applications/${applicationId}/submission/manual-resolution`, {
                    attemptId: audit.attemptId,
                    resolution: "CONFIRMED_SUBMITTED",
                  })
                }
                type="button"
              >
                Mark as submitted after manual verification
              </button>
              <button
                className="btn-secondary"
                disabled={pending !== null}
                onClick={() =>
                  void post("not-submitted", `/api/applications/${applicationId}/submission/manual-resolution`, {
                    attemptId: audit.attemptId,
                    resolution: "CONFIRMED_NOT_SUBMITTED",
                  })
                }
                type="button"
              >
                Mark as not submitted after manual verification
              </button>
            </>
          ) : null}
          {audit.canRetry ? (
            <button
              className="btn-primary"
              disabled={pending !== null}
              onClick={() =>
                void post("retry", `/api/applications/${applicationId}/submission/retry`, { attemptId: audit.attemptId })
              }
              type="button"
            >
              Retry with new authorization
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" data-testid="external-message">
          {message}
        </p>
      ) : null}
    </section>
  );
}
