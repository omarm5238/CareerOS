import Link from "next/link";

import type { CommunicationDraftListItem, CommunicationResumeOption } from "../types";
import { COMMUNICATION_TYPE_LABELS } from "../types";
import { CommunicationGenerateDialog } from "./communication-generate-dialog";
import { CommunicationStatusChip } from "./communication-status-badge";

type JobCoverLetterEntryProps = {
  jobId: string;
  jobTitle: string;
  company: string;
  resumeOptions: CommunicationResumeOption[];
  drafts: CommunicationDraftListItem[];
};

export function JobCoverLetterEntry({
  jobId,
  jobTitle,
  company,
  resumeOptions,
  drafts,
}: JobCoverLetterEntryProps) {
  const ready = resumeOptions.find((option) => option.versionStatus === "READY") ?? resumeOptions[0] ?? null;

  return (
    <section className="surface-glass p-5" id="job-communication">
      <p className="section-eyebrow">Communication</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        Cover letter for this job
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Generate a job-scoped draft without creating an Application. CareerOS will not send it.
      </p>

      {resumeOptions.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          Create a tailored resume first, then generate a cover letter from that evidence.
        </p>
      ) : (
        <div className="mt-4">
          <CommunicationGenerateDialog
            company={company}
            contacts={[]}
            defaultResumeRevisionId={ready?.revisionId ?? null}
            defaultResumeVersionId={ready?.versionId ?? null}
            defaultType="COVER_LETTER"
            jobPostingId={jobId}
            jobTitle={jobTitle}
            resumeOptions={resumeOptions}
            triggerLabel="Generate Cover Letter"
          />
        </div>
      )}

      {drafts.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {drafts.slice(0, 3).map((draft) => (
            <li key={draft.id}>
              <Link
                className="block rounded-md border border-[var(--color-border)] px-3 py-2 text-sm [transition:var(--motion-fade)] hover:border-[var(--color-accent)]"
                href={`/workspace/communications/${draft.id}`}
              >
                <span className="text-[var(--color-text-primary)]">
                  {COMMUNICATION_TYPE_LABELS[draft.type]}
                </span>
                <span className="ml-2">
                  <CommunicationStatusChip status={draft.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
