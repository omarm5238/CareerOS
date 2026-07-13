import type { ResumeAnalysisResult } from "@/features/resume";
import { AnalysisSourceBadge } from "@/features/resume/components/analysis-source-badge";

type AnalysisResultStepProps = {
  result: ResumeAnalysisResult;
  onEnterWorkspace: () => void;
  onReplaceResume: () => void;
};

export function AnalysisResultStep({
  result,
  onEnterWorkspace,
  onReplaceResume,
}: AnalysisResultStepProps) {
  const showFallbackNote =
    result.analysisSource === "rule_based" &&
    (result.aiWarnings?.length ?? 0) > 0;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
            Step 4 of 4
          </p>
          <AnalysisSourceBadge source={result.analysisSource} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          First profile ready
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          Your initial profile has been created from{" "}
          <strong>{result.resume.filename}</strong>.
        </p>
        {showFallbackNote ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            AI analysis was unavailable. A rule-based profile was generated instead.
          </p>
        ) : null}
      </header>

      <div className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Detected role" value={result.role} />
          <Metric label="Experience level" value={result.experienceLevel} />
          <Metric
            label="Profile completeness"
            value={`${result.completenessScore}%`}
          />
          <Metric
            label="Detected skills"
            value={String(result.detectedSkills.length)}
          />
        </div>

        <Metric
          label="Extracted text length"
          value={`${result.resume.textLength.toLocaleString()} characters`}
        />

        {result.profileSummary ? (
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Profile summary
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
              {result.profileSummary}
            </p>
          </div>
        ) : null}

        <StringListSection items={result.detectedSkills} label="Skills" emptyLabel="No skills detected." />

        <StringListSection
          items={result.strengths}
          label="Strengths"
          emptyLabel="No strengths identified."
        />

        <StringListSection
          items={result.weaknesses}
          label="Weaknesses"
          emptyLabel="No weaknesses identified."
        />

        <StringListSection
          items={result.atsRecommendations}
          label="ATS recommendations"
          emptyLabel="No ATS recommendations available."
        />

        <StringListSection
          items={result.suggestedFocus}
          label="Suggested next focus"
          emptyLabel="No focus areas suggested."
        />
      </div>

      <button
        className="w-full rounded-[var(--radius-lg)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        onClick={onEnterWorkspace}
        type="button"
      >
        Enter Workspace
      </button>

      <button
        className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        onClick={onReplaceResume}
        type="button"
      >
        Replace resume
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <p className="text-[11px] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function StringListSection({
  label,
  items,
  emptyLabel,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
        {label}
      </p>
      {items.length > 0 ? (
        label === "Skills" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((item) => (
              <span
                className="rounded-full border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-primary)]">
            {items.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{emptyLabel}</p>
      )}
    </div>
  );
}
