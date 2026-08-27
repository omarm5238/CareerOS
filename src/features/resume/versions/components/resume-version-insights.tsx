import type {
  ResumeVersionChangeLogItem,
  ResumeVersionEvidenceNote,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionWarning,
} from "../types";
import {
  EvidenceStrengthChip,
  keywordActionLabel,
  WarningSeverityChip,
} from "./resume-version-badges";

export function ResumeVersionAlignment({
  before,
  after,
}: {
  before: number | null;
  after: number | null;
}) {
  const delta = before !== null && after !== null ? after - before : null;
  const deltaLabel =
    delta === null ? "—" : delta > 0 ? `+${delta}` : delta === 0 ? "0" : `${delta}`;

  return (
    <section className="surface-glass p-5 no-print">
      <p className="section-eyebrow">Estimated ATS Alignment</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ScoreCell label="Before" value={before} />
        <ScoreCell label="After" value={after} />
        <div className="surface-card p-3">
          <dt className="text-[11px] text-[var(--color-text-secondary)]">Delta</dt>
          <dd className="mt-1 metric-number text-2xl text-[var(--color-text-primary)]">
            {deltaLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        Estimated alignment, not a guarantee of ATS acceptance.
      </p>
    </section>
  );
}

function ScoreCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="surface-card p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 metric-number text-2xl text-[var(--color-text-primary)]">
        {value === null ? "—" : value}
      </dd>
    </div>
  );
}

export function ResumeVersionKeywordMap({
  items,
}: {
  items: ResumeVersionKeywordCoverageItem[];
}) {
  return (
    <section className="surface-glass p-5 no-print" id="keyword-map">
      <p className="section-eyebrow">Keyword Map</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        Job keywords and supporting evidence
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No keyword coverage was recorded for this revision.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="surface-card p-3" key={item.keyword}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {item.keyword}
                </p>
                <EvidenceStrengthChip strength={item.evidenceStrength} />
              </div>

              <dl className="mt-2 grid gap-2 text-[11px] text-[var(--color-text-secondary)] sm:grid-cols-4">
                <Fact label="Type" value={item.type.replace(/_/g, " ")} />
                <Fact label="Importance" value={item.importance} />
                <Fact
                  label="In original resume"
                  value={item.presentInOriginalResume ? "Yes" : "No"}
                />
                <Fact
                  label="Used in tailored"
                  value={item.usedInTailoredResume ? "Yes" : "No"}
                />
              </dl>

              <p className="mt-2 text-xs text-[var(--color-text-primary)]">
                Action: {keywordActionLabel(item.action)}
                {item.requiredByJob ? " · Required by job" : ""}
              </p>
              {item.note ? (
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {item.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mt-0.5 font-mono-meta text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

export function ResumeVersionWarnings({ items }: { items: ResumeVersionWarning[] }) {
  return (
    <section className="surface-glass p-5 no-print" id="warnings">
      <p className="section-eyebrow">Warnings</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        Things to check before applying
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No warnings were recorded for this revision.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((warning, index) => (
            <li className="surface-insight p-3" key={`${warning.type}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  {warning.type.replace(/_/g, " ")}
                </p>
                <WarningSeverityChip severity={warning.severity} />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
                {warning.message}
              </p>
              {warning.recommendation ? (
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  Suggested: {warning.recommendation}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ResumeVersionEvidenceNotes({
  items,
}: {
  items: ResumeVersionEvidenceNote[];
}) {
  return (
    <section className="surface-glass p-5 no-print" id="evidence-notes">
      <p className="section-eyebrow">Evidence Notes</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        What your resume can actually support
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No evidence notes were recorded for this revision.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((note, index) => (
            <li className="surface-card p-3" key={`${note.claim}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {note.claim}
                </p>
                <EvidenceStrengthChip strength={note.strength} />
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {note.evidence || "No evidence recorded."}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-primary)]">
                {note.safeToUse
                  ? "Safe to use in this resume."
                  : "Not safe to claim as experience yet."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ResumeVersionChangeLog({
  items,
}: {
  items: ResumeVersionChangeLogItem[];
}) {
  return (
    <section className="surface-glass p-5 no-print" id="change-log">
      <p className="section-eyebrow">Change Log</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        What changed and why
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No change log entries were recorded for this revision.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li className="surface-card p-3" key={`${item.section}-${index}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                {item.section}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-primary)]">
                {item.change}
              </p>
              {item.reason ? (
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  Reason: {item.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
