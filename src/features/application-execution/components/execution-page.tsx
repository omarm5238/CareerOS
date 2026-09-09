"use client";

import { useEffect, useState } from "react";

import type { ExecutionSessionView } from "../types";
import { ExecutionProgress } from "./execution-progress";
import { FinalApplicationReview } from "./final-application-review";
import { PendingActionsPanel } from "./pending-actions-panel";
import { SubmissionStatus } from "./submission-status";

export function ExecutionPage({ initial }: { initial: ExecutionSessionView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function call(path: string, method: string, body?: unknown) {
    setPending(true);
    setError(null);
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    const json = (await response.json()) as ExecutionSessionView & { message?: string; approvalToken?: string; attemptId?: string };
    setPending(false);
    if (!response.ok) {
      setError(json.message ?? "Request failed.");
      return json;
    }
    if (json.id) setView(json);
    return json;
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetch(`/api/application-execution/sessions/${initial.id}`)
        .then((response) => response.json())
        .then((json: ExecutionSessionView) => {
          if (json.id) setView(json);
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [initial.id]);

  async function approveAndSubmit() {
    const approval = await call(`/api/application-execution/sessions/${view.id}/approve-submit`, "POST");
    if (approval.approvalToken && approval.attemptId) {
      await call(`/api/application-execution/sessions/${view.id}/submit`, "POST", {
        attemptId: approval.attemptId,
        approvalToken: approval.approvalToken,
      });
    }
  }

  return (
    <div className="relative mx-auto module-shell px-4 py-6 lg:px-8 lg:py-9">
      <header className="surface-glass p-4">
        <p className="section-eyebrow">Assisted application</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{view.jobTitle}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{view.company}</p>
        <dl className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          <div>{view.provider.replaceAll("_", " ")}</div>
          <div>{view.executionMode.replaceAll("_", " ")}</div>
          <div>{view.status.replaceAll("_", " ")}</div>
          <div>{view.browserConnected ? "Browser connected" : "Browser interrupted"}</div>
          <div className="sm:col-span-2">{view.currentDomain ?? "No page yet"}</div>
        </dl>
        {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => void call(`/api/application-execution/sessions/${view.id}/start`, "POST")} type="button">
            Start
          </button>
          <button className="btn-secondary" disabled={pending} onClick={() => void call(`/api/application-execution/sessions/${view.id}/fill`, "POST")} type="button">
            Fill safe fields
          </button>
          <button className="btn-secondary" disabled={pending} onClick={() => void call(`/api/application-execution/sessions/${view.id}/continue`, "POST")} type="button">
            Continue
          </button>
          <button className="btn-secondary" disabled={pending} onClick={() => void call(`/api/application-execution/sessions/${view.id}/review`, "POST")} type="button">
            Review
          </button>
          <button className="btn-secondary" disabled={pending} onClick={() => void call(`/api/application-execution/sessions/${view.id}/cancel`, "POST")} type="button">
            Cancel
          </button>
        </div>
      </header>

      <div className="mt-4 space-y-4">
        <ExecutionProgress view={view} />
        <PendingActionsPanel
          view={view}
          onResume={() => void call(`/api/application-execution/sessions/${view.id}/resume`, "POST")}
          onGenerate={(fieldId) => void call(`/api/application-execution/sessions/${view.id}/answers/${encodeURIComponent(fieldId)}/generate`, "POST")}
          onConfirm={(fieldId, value, extras) =>
            void call(`/api/application-execution/sessions/${view.id}/answers/${encodeURIComponent(fieldId)}`, "PATCH", {
              value,
              confirmed: true,
              reviewed: extras?.reviewed === true,
            })
          }
        />
        <FinalApplicationReview view={view} />
        <SubmissionStatus
          view={view}
          onApproveSubmit={() => void approveAndSubmit()}
          onVerify={() => void call(`/api/application-execution/sessions/${view.id}/verify`, "POST")}
          onConfirm={(outcome) => void call(`/api/application-execution/sessions/${view.id}/confirm-outcome`, "POST", { outcome })}
        />
      </div>
    </div>
  );
}
