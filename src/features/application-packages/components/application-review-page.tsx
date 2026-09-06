"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MATCH_STRENGTH_LABELS, PRIORITY_BAND_LABELS } from "@/features/jobs/opportunities/types";
import { JobsSubNav } from "@/features/jobs/components/jobs-sub-nav";

import type { ApplicationPackageView } from "../types";

export function ApplicationReviewPage({
  detail,
  siblingIds,
}: {
  detail: ApplicationPackageView;
  siblingIds: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyUrl, setApplyUrl] = useState<string | null>(null);

  const index = siblingIds.indexOf(detail.id);
  const nextId = index >= 0 ? siblingIds[index + 1] : null;

  async function post(path: string, body?: unknown) {
    setPending(path);
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    const json = (await response.json()) as Record<string, unknown>;
    setPending(null);
    if (!response.ok) {
      setError(typeof json.message === "string" ? json.message : "Request failed.");
      return null;
    }
    router.refresh();
    return json;
  }

  async function saveInput(key: string, value: string) {
    setPending(key);
    const response = await fetch(`/api/application-packages/${detail.id}/inputs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, confirmed: true }),
    });
    const json = (await response.json()) as { message?: string };
    setPending(null);
    if (!response.ok) {
      setError(json.message ?? "Could not save that answer.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative mx-auto module-shell px-4 py-6 lg:px-8 lg:py-9">
      <JobsSubNav />
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:gap-6">
        <div className="space-y-4">
          <header className="surface-glass p-5">
            <p className="section-eyebrow">
              {detail.priorityBand ? PRIORITY_BAND_LABELS[detail.priorityBand] : "Application package"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{detail.jobTitle}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {detail.company}
              {detail.location ? ` · ${detail.location}` : ""}
            </p>
            <dl className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
              <div>Opportunity Score {detail.opportunityScore ?? "—"}</div>
              <div>Evidence Coverage {detail.evidenceCoverage ?? "—"}%</div>
              <div>Application Effort {detail.applicationEffort ?? "Unknown"}</div>
              <div>Version {detail.version}</div>
            </dl>
            {detail.stale ? (
              <div className="mt-4 rounded-md border border-[var(--color-border)] p-3 text-sm">
                <p className="font-medium text-[var(--color-text-primary)]">Package context changed</p>
                <p className="mt-1 text-[var(--color-text-secondary)]">
                  The existing package has not been modified.
                </p>
                <button
                  className="btn-secondary mt-3"
                  onClick={() => void post(`/api/application-packages/${detail.id}/refresh`)}
                  type="button"
                >
                  Refresh Package
                </button>
              </div>
            ) : null}
          </header>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Why you match</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-primary)]">
              {detail.whyYouMatch.length > 0 ? detail.whyYouMatch.map((item) => <li key={item}>{item}</li>) : <li>See requirements and evidence below.</li>}
            </ul>
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Requirements and evidence</p>
            <ul className="mt-4 space-y-3">
              {detail.requirements.map((requirement) => (
                <li key={requirement.id} className="border-b border-[var(--color-border-subtle)] pb-3 last:border-0">
                  <p className="font-medium text-[var(--color-text-primary)]">{requirement.normalizedName}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {requirement.importance} · {requirement.bestMatch ? MATCH_STRENGTH_LABELS[requirement.bestMatch.matchStrength] : "None"}
                    {requirement.bestMatch ? ` · ${requirement.bestMatch.evidenceLabel}` : ""}
                  </p>
                  <details className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    <summary>Details</summary>
                    <p className="mt-2">Job: {requirement.sourceExcerpt}</p>
                    {requirement.bestMatch?.reasoning ? <p className="mt-1">{requirement.bestMatch.reasoning}</p> : null}
                  </details>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Gaps</p>
            <ul className="mt-3 space-y-2 text-sm">
              {detail.gaps.map((gap) => (
                <li key={`${gap.requirementName}-${gap.severity}`}>
                  <span className="font-medium text-[var(--color-text-primary)]">{gap.requirementName}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {" "}
                    · {gap.severity} · {gap.recommendedAction.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <p className="text-[var(--color-text-secondary)]">{gap.explanation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Eligibility</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              {detail.eligibilityChecks.map((check) => (
                <li key={check.key}>
                  {check.key.replaceAll("_", " ")} · {check.status.replaceAll("_", " ")}
                  <p>{check.reason}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Tailored resume</p>
            <p className="mt-2 text-[var(--color-text-primary)]">
              {detail.resumeTitle ?? "Resume"} · Revision {detail.resumeRevisionNumber ?? "—"}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">Status {detail.resumeStatus ?? "unknown"}</p>
            {detail.resumeStatus === "DRAFT" ? (
              <p className="mt-2 text-sm">Needs your approval</p>
            ) : null}
            {detail.resumeVersionId ? (
              <Link className="btn-secondary mt-3 inline-flex" href={`/workspace/resume/versions/${detail.resumeVersionId}`}>
                Open Resume
              </Link>
            ) : null}
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Cover letter</p>
            {detail.coverLetterRequired && detail.coverLetterDraftId ? (
              <>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Status {detail.coverLetterStatus}</p>
                <Link className="btn-secondary mt-3 inline-flex" href={`/workspace/communications/${detail.coverLetterDraftId}`}>
                  Open
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Not required for this package</p>
            )}
          </section>

          <section className="surface-glass p-5">
            <p className="section-eyebrow">Required user inputs</p>
            {detail.requiredUserInputs.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No additional confirmation items.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {detail.requiredUserInputs.map((item) => (
                  <li key={item.key}>
                    <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
                    {item.resolved ? (
                      <p className="mt-1 text-sm">Confirmed: {item.value}</p>
                    ) : (
                      <form
                        className="mt-2 flex flex-wrap gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void saveInput(item.key, String(form.get("value") ?? ""));
                        }}
                      >
                        <input
                          className="min-w-[180px] flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                          name="value"
                          placeholder="Enter your confirmation"
                        />
                        <button className="btn-secondary" disabled={pending === item.key} type="submit">
                          Confirm
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="mt-4 space-y-4 lg:sticky lg:top-6 lg:mt-0">
          <section className="surface-glass p-5">
            <p className="section-eyebrow">Application QA</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              {detail.userFacingState.replaceAll("_", " ")}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              {detail.qa.checks.map((check) => (
                <li key={check.key}>
                  {check.passed ? "✓" : "!"} {check.message}
                </li>
              ))}
            </ul>
            {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}

            {detail.status === "READY_FOR_REVIEW" ? (
              <button
                className="btn-primary mt-4 w-full"
                disabled={detail.readinessStatus !== "READY" || pending !== null}
                onClick={() => void post(`/api/application-packages/${detail.id}/approve`)}
                type="button"
              >
                Approve Package
              </button>
            ) : null}

            {detail.status === "APPROVED" || detail.status === "SUBMISSION_STARTED" ? (
              <button
                className="btn-primary mt-4 w-full"
                disabled={pending !== null}
                onClick={async () => {
                  const result = await post(`/api/application-packages/${detail.id}/start-submission`);
                  if (result && typeof result.applyUrl === "string") {
                    setApplyUrl(result.applyUrl);
                    window.open(result.applyUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                type="button"
              >
                Open Application
              </button>
            ) : null}

            {applyUrl ? (
              <p className="mt-3 text-sm">
                Popup blocked?{" "}
                <a className="underline" href={applyUrl} rel="noreferrer" target="_blank">
                  Open apply URL
                </a>
              </p>
            ) : null}

            {detail.status === "SUBMISSION_STARTED" ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Application opened externally. CareerOS has NOT marked this application as submitted.
                </p>
                <button className="btn-primary w-full" onClick={() => void post(`/api/application-packages/${detail.id}/confirm-submission`, { outcome: "SUBMITTED" })} type="button">
                  I Submitted It
                </button>
                <button className="btn-secondary w-full" onClick={() => void post(`/api/application-packages/${detail.id}/confirm-submission`, { outcome: "NOT_YET" })} type="button">
                  Not Yet
                </button>
                <button className="btn-secondary w-full" onClick={() => void post(`/api/application-packages/${detail.id}/confirm-submission`, { outcome: "CLOSED" })} type="button">
                  Job Was Closed
                </button>
                <button className="btn-secondary w-full" onClick={() => void post(`/api/application-packages/${detail.id}/confirm-submission`, { outcome: "DECLINED_TO_APPLY" })} type="button">
                  I Decided Not to Apply
                </button>
              </div>
            ) : null}

            {detail.status === "APPROVED" ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Package approved. Application draft created or reused. CareerOS has not submitted anything.
              </p>
            ) : null}

            {nextId ? (
              <Link className="btn-secondary mt-4 inline-flex w-full justify-center" href={`/workspace/jobs/apply-now/${nextId}`}>
                Review {index + 1} of {siblingIds.length} · Next
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
