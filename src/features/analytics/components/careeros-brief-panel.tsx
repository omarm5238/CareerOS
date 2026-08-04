import type { CareerBriefView } from "../types";
import { ActionCenterPanel } from "./action-center-panel";
import { CareerBriefSourceBadge } from "./career-brief-source-badge";
import { GenerateCareerBriefButton } from "./generate-career-brief-button";

type CareerosBriefPanelProps = {
  brief: CareerBriefView | null;
  fallbackActionSections?: CareerBriefView["actionCenter"];
  targetJobId?: string | null;
};

function formatGeneratedDate(value: string | null): string {
  if (!value) return "Not generated yet";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function severityClass(level: string): string {
  if (level === "High") {
    return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
  }
  if (level === "Medium") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  }
  return "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";
}

export function CareerosBriefPanel({
  brief,
  fallbackActionSections = [],
  targetJobId,
}: CareerosBriefPanelProps) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="careeros-brief-heading"
        className="surface-glass p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
              id="careeros-brief-heading"
            >
              CareerOS Brief
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              A practical readiness snapshot with risks, opportunities, and what to do next.
            </p>
          </div>

          <GenerateCareerBriefButton
            analysisSource={brief?.analysisSource ?? null}
            hasBrief={!!brief}
            targetJobId={targetJobId}
          />
        </div>

        {brief ? (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <CareerBriefSourceBadge
                isStale={brief.isStale}
                source={brief.analysisSource}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Last generated: {formatGeneratedDate(brief.generatedAt)}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Brief health: {brief.healthScore}%
              </p>
            </div>

            {brief.isStale ? (
              <div className="surface-insight p-4">
                <p className="text-sm font-medium text-[var(--status-warning-text)]">
                  Needs refresh
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Resume or saved-job data changed since this brief was generated. Refresh when ready; the existing brief remains available.
                </p>
              </div>
            ) : null}

            {brief.warnings.length > 0 ? (
              <div className="surface-insight p-4">
                <h3 className="text-sm font-medium text-[var(--status-warning-text)]">Insights</h3>
                <ul className="mt-2 space-y-1.5">
                  {brief.warnings.map((warning) => (
                    <li className="text-sm leading-5 text-[var(--color-text-secondary)]" key={warning}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {brief.dataSourceNotes.length > 0 ? (
              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                Data notes: {brief.dataSourceNotes.join(" · ")}
              </p>
            ) : null}

            {brief.headline ? (
              <div>
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  {brief.headline}
                </h3>
                {brief.summary ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {brief.summary}
                  </p>
                ) : null}
              </div>
            ) : null}

            {brief.topRisks.length > 0 ? (
              <BriefList
                items={brief.topRisks.slice(0, 3).map((item) => ({
                  title: item.title,
                  detail: item.reason,
                  badge: item.severity,
                }))}
                title="Top Risks"
              />
            ) : null}

            {brief.topOpportunities.length > 0 ? (
              <BriefList
                items={brief.topOpportunities.map((item) => ({
                  title: item.title,
                  detail: item.reason,
                  badge: item.impact,
                }))}
                title="Top Opportunities"
              />
            ) : null}

            {brief.nextActions.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  Next Actions
                </h3>
                <ul className="mt-3 space-y-2">
                  {brief.nextActions.slice(0, 3).map((item) => (
                    <li
                      className="surface-card p-3"
                      key={item.title}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {item.title}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                          {item.category}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] ${severityClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {item.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {brief.careerExecutionPlan && brief.careerExecutionPlan.weeks.length > 0 ? (
              <div className="surface-card p-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  30-Day Execution Plan preview
                </h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {brief.careerExecutionPlan.startDate} → {brief.careerExecutionPlan.endDate} · ~
                  {brief.careerExecutionPlan.totalEstimatedHours}h
                </p>
                <ul className="mt-3 space-y-1">
                  {brief.careerExecutionPlan.weeks.slice(0, 4).map((week) => (
                    <li className="text-sm text-[var(--color-text-secondary)]" key={week.week}>
                      {week.week}: {week.focus}
                    </li>
                  ))}
                </ul>
                <a
                  className="mt-3 inline-block text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
                  href="#execution-plan"
                >
                  Jump to full 30-Day Career Execution Plan
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
            No CareerOS Brief yet. Generate one from your resume, jobs, and skills data.
          </p>
        )}
      </section>

      <ActionCenterPanel
        sections={
          fallbackActionSections.length > 0
            ? fallbackActionSections
            : brief?.actionCenter ?? []
        }
        showGenerateCta={!brief}
      />
    </div>
  );
}

function BriefList({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; detail: string; badge: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            className="surface-card p-3"
            key={item.title}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {item.title}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] ${severityClass(item.badge)}`}
              >
                {item.badge}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
