import type { ApplicationTimelineItem } from "../types";
import { formatApplicationDateTime } from "./application-badges";

type ApplicationTimelineProps = {
  items: ApplicationTimelineItem[];
};

export function ApplicationTimeline({ items }: ApplicationTimelineProps) {
  // Chronological for reading: oldest at the top, newest at the bottom.
  const ordered = [...items].sort(
    (a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime(),
  );

  return (
    <section className="surface-glass p-5" id="timeline">
      <p className="section-eyebrow">Timeline</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        What has happened
      </h2>

      {ordered.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          No events recorded yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-0">
          {ordered.map((item, index) => (
            <li className="relative flex gap-4 pb-6 last:pb-0" key={item.id}>
              {index < ordered.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-3 h-full w-px bg-[var(--color-border)]"
                />
              ) : null}
              <span
                aria-hidden
                className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border border-[var(--color-accent)] bg-[var(--color-surface)]"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-1 font-mono-meta text-[var(--color-text-secondary)]">
                  {formatApplicationDateTime(item.eventAt)}
                  {item.source === "USER" ? " · You recorded this" : ""}
                </p>
                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
