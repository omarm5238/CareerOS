import {
  formatAnalyzedDate,
  formatResumeFileSize,
} from "../lib/format-resume-display";
import type { ResumeModuleAnalysis } from "../types";

type ResumeMetadataSectionProps = {
  analysis: ResumeModuleAnalysis;
};

export function ResumeMetadataSection({ analysis }: ResumeMetadataSectionProps) {
  return (
    <section
      aria-labelledby="resume-metadata-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-metadata-heading"
      >
        Resume Metadata
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetadataItem label="Filename" value={analysis.filename} />
        <MetadataItem label="File size" value={formatResumeFileSize(analysis.fileSize)} />
        <MetadataItem
          label="Extracted text length"
          value={`${analysis.textLength.toLocaleString()} characters`}
        />
        <MetadataItem label="Analyzed on" value={formatAnalyzedDate(analysis.analyzedAt)} />
      </dl>
    </section>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
