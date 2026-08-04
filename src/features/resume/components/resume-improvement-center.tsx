import type {
  ResumeImprovementCenterData,
  ResumeImprovementItem,
} from "../types/resume-improvement";

type ResumeImprovementCenterProps = {
  data: ResumeImprovementCenterData;
};

function priorityClass(priority: string): string {
  if (priority === "high") {
    return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
  }
  if (priority === "medium") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  }
  return "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";
}

function actionLabel(item: ResumeImprovementItem): string {
  const text = `${item.title} ${item.reason}`.toLowerCase();
  if (/\b(keyword|tailor).*(target|job)|align resume keywords\b/.test(text)) {
    return "Tailor to target";
  }
  if (/\b(portfolio|github|project link|live project)\b/.test(text)) {
    return "Add evidence";
  }
  if (
    item.group === "Clarity & Formatting" ||
    /\b(format|section heading|bullet point|contact information)\b/.test(text)
  ) {
    return "Fix structure";
  }
  if (
    /\b(certif|internship|work experience|award|education date|degree)\b/.test(text)
  ) {
    return "Add if true";
  }
  if (item.evidenceRule === "needs_proof_first" || item.evidenceRule === "do_not_add_yet") {
    return "Needs proof first";
  }
  return "Add if true";
}

export function ResumeImprovementCenter({ data }: ResumeImprovementCenterProps) {
  return (
    <section
      aria-labelledby="resume-improvement-center-heading"
      className="surface-glass p-5"
      id="resume-improvement-center"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-improvement-center-heading"
      >
        Resume Improvement Center
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
        Continuous resume fixes independent of skills strategy. Only add claims you can support with
        real evidence.
      </p>

      {data.itemCount === 0 ? (
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          No major resume fixes identified yet. Keep strengths explicit and re-analyze after edits.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {data.groups.map((group) => (
            <div key={group.group}>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {group.group}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li
                    className="surface-card p-3"
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.title}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                        {actionLabel(item)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Where to fix: {item.whereToFix}
                    </p>
                    {item.exampleImprovement ? (
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Example: {item.exampleImprovement}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
