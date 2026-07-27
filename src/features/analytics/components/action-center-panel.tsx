import type { CareerBriefActionCenterSection } from "../ai/types";
import { GenerateCareerBriefButton } from "./generate-career-brief-button";

type ActionCenterPanelProps = {
  sections: CareerBriefActionCenterSection[];
  showGenerateCta?: boolean;
};

function priorityClass(priority: string): string {
  if (priority === "High") {
    return "border-[rgb(239_68_68_/_30%)] bg-[rgb(239_68_68_/_10%)] text-[rgb(252_165_165)]";
  }
  if (priority === "Medium") {
    return "border-[rgb(245_158_11_/_30%)] bg-[rgb(245_158_11_/_10%)] text-[rgb(253_186_116)]";
  }
  return "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";
}

export function ActionCenterPanel({
  sections,
  showGenerateCta = false,
}: ActionCenterPanelProps) {
  return (
    <section
      aria-labelledby="action-center-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
            id="action-center-heading"
          >
            Action Center
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Central next steps across resume, skills, jobs, and applications.
          </p>
        </div>
        {showGenerateCta ? (
          <GenerateCareerBriefButton analysisSource={null} hasBrief={false} />
        ) : null}
      </div>

      {sections.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          Generate a CareerOS Brief to populate Action Center.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {sections.map((section) => (
            <div key={section.section}>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {section.section}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3"
                    key={`${section.section}-${item.title}`}
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
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
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
