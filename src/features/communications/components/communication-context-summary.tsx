import type { CommunicationDraftDetail } from "../types";
import { COMMUNICATION_TYPE_LABELS } from "../types";

export function CommunicationContextSummary({ draft }: { draft: CommunicationDraftDetail }) {
  const snapshot = draft.activeRevision?.contextSnapshot;
  const settings = snapshot?.settings;

  return (
    <section className="surface-glass p-5" id="context-used">
      <p className="section-eyebrow">Context Used</p>
      <dl className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        <Item label="Type" value={COMMUNICATION_TYPE_LABELS[draft.type]} />
        <Item
          label="Job"
          value={
            draft.jobTitle
              ? `${draft.jobTitle}${draft.company ? ` — ${draft.company}` : ""}`
              : "Not linked to a saved job"
          }
        />
        <Item
          label="Application"
          value={
            draft.linkedToApplication
              ? draft.applicationStatus ?? "Linked"
              : "Not linked to an Application"
          }
        />
        <Item
          label="Resume"
          value={
            draft.resumeRevisionNumber
              ? `Revision ${draft.resumeRevisionNumber}${
                  draft.resumeVersionStatus ? ` · ${draft.resumeVersionStatus}` : ""
                }`
              : "No exact resume revision linked"
          }
        />
        <Item
          label="Recipient"
          value={
            draft.recipientName
              ? `${draft.recipientName}${draft.recipientRole ? ` — ${draft.recipientRole}` : ""}`
              : settings?.recipientMode === "HIRING_TEAM"
                ? "Hiring Team"
                : "Unknown recipient"
          }
        />
        {settings?.offerIntent ? <Item label="Offer intent" value={settings.offerIntent} /> : null}
      </dl>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em]">{label}</dt>
      <dd className="text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
