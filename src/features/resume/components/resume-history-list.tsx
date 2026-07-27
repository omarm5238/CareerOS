"use client";

import Link from "next/link";

import { formatAnalyzedDate } from "../lib/format-resume-display";
import type { ResumeAnalysisHistoryItem } from "../types";
import { AnalysisSourceBadge } from "./analysis-source-badge";
import { DeleteResumeHistoryItemButton } from "./delete-resume-history-item-button";

type ResumeHistoryListProps = {
  items: ResumeAnalysisHistoryItem[];
  selectedDocumentId: string | null;
  latestDocumentId: string | null;
};

export function ResumeHistoryList({
  items,
  selectedDocumentId,
  latestDocumentId,
}: ResumeHistoryListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="resume-history-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-history-heading"
      >
        Analysis History
      </h2>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Latest {items.length} analyses. Selecting an item opens that result.
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const isSelected = item.resumeDocumentId === selectedDocumentId;
          const isLatest = item.resumeDocumentId === latestDocumentId;
          const href = `/workspace/resume?documentId=${encodeURIComponent(item.resumeDocumentId)}`;

          return (
            <li key={item.resumeDocumentId}>
              <Link
                aria-current={isSelected ? "page" : undefined}
                className={`block rounded-[var(--radius-md)] border px-3 py-3 [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isSelected
                    ? "border-[rgb(99_102_241_/_40%)] bg-[rgb(99_102_241_/_10%)]"
                    : "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] hover:border-[var(--color-border)]"
                }`}
                href={href}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {item.filename}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.detectedRole} · {item.completenessScore}% complete
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {formatAnalyzedDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {isLatest ? (
                      <span className="rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_70%)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                        Latest
                      </span>
                    ) : null}
                    <AnalysisSourceBadge source={item.analysisSource} />
                    <DeleteResumeHistoryItemButton documentId={item.resumeDocumentId} />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
