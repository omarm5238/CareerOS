import type { CommunicationRevisionDetail } from "../types";

export function CommunicationInternalReview({ revision }: { revision: CommunicationRevisionDetail }) {
  return (
    <section className="surface-glass p-5" id="internal-review">
      <p className="section-eyebrow">Internal review</p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
        Evidence and warnings stay inside CareerOS. They are not copied with the message.
      </p>

      <h3 className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Evidence Used</h3>
      {revision.evidenceUsed.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No evidence items were recorded.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {revision.evidenceUsed.map((item) => (
            <li key={`${item.source}-${item.label}`}>
              {item.label} — {labelForSource(item.source)}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Warnings</h3>
      {revision.warnings.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No warnings.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {revision.warnings.map((item) => (
            <li key={`${item.code}-${item.message}`}>{item.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function labelForSource(source: string): string {
  if (source === "resume") return "Resume";
  if (source === "job") return "Job";
  if (source === "application") return "Application";
  if (source === "contact") return "Contact";
  if (source === "timeline") return "Timeline";
  if (source === "user_note") return "User note";
  return source;
}
