"use client";

import type { ExecutionSessionView } from "../types";

export function ExecutionProgress({ view }: { view: ExecutionSessionView }) {
  return (
    <section className="surface-glass p-4">
      <p className="section-eyebrow">Progress</p>
      <ul className="mt-3 space-y-2 text-sm">
        {view.progress
          .filter((item) => item.state !== "not_present")
          .map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <span className="text-[var(--color-text-primary)]">{item.label}</span>
              <span className="text-[var(--color-text-secondary)]">
                {item.state.replaceAll("_", " ")}
                {item.countLabel ? ` · ${item.countLabel}` : ""}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}
