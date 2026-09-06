import Link from "next/link";

import type { ApplicationStatus } from "@/generated/prisma/client";

import {
  COMMUNICATION_LANGUAGE_LABELS,
  COMMUNICATION_TYPE_LABELS,
  type CommunicationContactOption,
  type CommunicationDraftListItem,
  type CommunicationRecommendation,
  type CommunicationResumeOption,
} from "../types";
import { CommunicationGenerateDialog } from "./communication-generate-dialog";
import { CommunicationStatusChip, formatCommunicationDate } from "./communication-status-badge";

type ApplicationCommunicationSectionProps = {
  applicationId: string;
  status: ApplicationStatus;
  jobTitle: string | null;
  company: string | null;
  jobPostingId?: string | null;
  recommendations: CommunicationRecommendation[];
  drafts: CommunicationDraftListItem[];
  archivedCount: number;
  contacts: CommunicationContactOption[];
  resumeOptions: CommunicationResumeOption[];
  defaultResumeVersionId?: string | null;
  defaultResumeRevisionId?: string | null;
  interviewCompleted: boolean;
};

export function ApplicationCommunicationSection({
  applicationId,
  status,
  jobTitle,
  company,
  jobPostingId,
  recommendations,
  drafts,
  archivedCount,
  contacts,
  resumeOptions,
  defaultResumeVersionId,
  defaultResumeRevisionId,
  interviewCompleted,
}: ApplicationCommunicationSectionProps) {
  return (
    <section className="surface-glass p-5" id="communication">
      <p className="section-eyebrow">Communication</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        What should I say now?
      </h2>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Recommended now
        </p>
        <ul className="mt-2 space-y-2">
          {recommendations.map((item) => (
            <li
              key={item.type}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm leading-6 text-[var(--color-text-secondary)]"
            >
              <span className="text-[var(--color-text-primary)]">{item.reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Recent drafts
        </p>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            No communication drafts yet for this application.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  className="block rounded-md border border-[var(--color-border)] px-3 py-2 [transition:var(--motion-fade)] hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  href={`/workspace/communications/${draft.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {COMMUNICATION_TYPE_LABELS[draft.type]}
                    </span>
                    <CommunicationStatusChip status={draft.status} />
                    {draft.language ? (
                      <span className="status-chip status-chip--mono">
                        {COMMUNICATION_LANGUAGE_LABELS[draft.language]}
                      </span>
                    ) : null}
                    {draft.activeRevisionNumber ? (
                      <span className="status-chip status-chip--mono">
                        Revision {draft.activeRevisionNumber}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono-meta text-[var(--color-text-secondary)]">
                    {draft.recipientName ?? "Unknown recipient"} ·{" "}
                    {formatCommunicationDate(draft.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {archivedCount > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {archivedCount} archived draft{archivedCount === 1 ? "" : "s"} preserved.
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        <CommunicationGenerateDialog
          applicationId={applicationId}
          applicationStatus={status}
          company={company}
          contacts={contacts}
          defaultResumeRevisionId={defaultResumeRevisionId}
          defaultResumeVersionId={defaultResumeVersionId}
          interviewCompleted={interviewCompleted}
          jobPostingId={jobPostingId}
          jobTitle={jobTitle}
          recommendations={recommendations}
          resumeOptions={resumeOptions}
        />
      </div>
    </section>
  );
}
