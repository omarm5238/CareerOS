import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import { COMMUNICATION_TYPE_LABELS } from "../types";
import type { CommunicationDraftDetail } from "../types";
import { CommunicationActions } from "./communication-actions";
import { CommunicationContextSummary } from "./communication-context-summary";
import { CommunicationEditor } from "./communication-editor";
import { CommunicationInternalReview } from "./communication-internal-review";
import { CommunicationRevisionHistory } from "./communication-revision-history";
import { CommunicationStaleBanner } from "./communication-stale-banner";
import {
  CommunicationLanguageChip,
  CommunicationSourceBadge,
  CommunicationStatusChip,
} from "./communication-status-badge";

type CommunicationDraftDetailPageProps = {
  draft: CommunicationDraftDetail;
};

export function CommunicationDraftDetailPage({ draft }: CommunicationDraftDetailPageProps) {
  const active = draft.activeRevision;
  const backHref = draft.applicationId
    ? `/workspace/applications/${draft.applicationId}`
    : draft.jobPostingId
      ? "/workspace/jobs"
      : "/workspace/applications";

  return (
    <WorkspaceModuleLayout title="Communication">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
          <CareerCore
            animated={false}
            className="h-full w-full"
            density="low"
            interactive={false}
            mode="workspace"
            pulse={false}
          />
        </div>

        <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href={backHref}
            >
              {draft.applicationId ? "Back to Application" : "Back to Jobs"}
            </Link>

            <div>
              <p className="section-eyebrow">Communication</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                {COMMUNICATION_TYPE_LABELS[draft.type]}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {draft.jobTitle ?? "Role unavailable"}
                {draft.company ? ` · ${draft.company}` : ""}
              </p>
              {!draft.linkedToApplication ? (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Not linked to an Application
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CommunicationStatusChip status={draft.status} />
              {active ? <CommunicationLanguageChip language={active.language} /> : null}
              {active ? (
                <span className="status-chip status-chip--mono">Revision {active.revisionNumber}</span>
              ) : null}
              {active ? (
                <CommunicationSourceBadge model={active.model} source={active.source} />
              ) : null}
            </div>

            <p className="text-sm text-[var(--color-text-secondary)]">
              Recipient:{" "}
              {draft.recipientName
                ? `${draft.recipientName}${draft.recipientRole ? ` — ${draft.recipientRole}` : ""}`
                : "Unknown recipient"}
            </p>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-6">
              {draft.contextStale ? <CommunicationStaleBanner draftId={draft.id} /> : null}

              {active?.source === "RULE_BASED_FALLBACK" ? (
                <section className="surface-glass p-5">
                  <p className="section-eyebrow">Rule-based fallback</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    AI generation is unavailable. CareerOS created a conservative factual draft using
                    your stored application context. You can still edit, save, copy, mark Ready, or
                    mark as Used.
                  </p>
                </section>
              ) : null}

              {active ? (
                <CommunicationEditor
                  content={active.content}
                  draftId={draft.id}
                  showSubject={draft.type !== "COVER_LETTER"}
                  subject={active.subject}
                />
              ) : (
                <section className="surface-glass p-5">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    This draft has no active revision yet.
                  </p>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <CommunicationActions
                content={active?.content ?? ""}
                draftId={draft.id}
                linkedToApplication={draft.linkedToApplication}
                status={draft.status}
                subject={active?.subject ?? null}
              />
              <CommunicationContextSummary draft={draft} />
              {active ? <CommunicationInternalReview revision={active} /> : null}
              <CommunicationRevisionHistory draftId={draft.id} revisions={draft.revisions} />
            </div>
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
