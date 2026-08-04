import { ChangeEvent, DragEvent, useMemo, useRef } from "react";

import {
  ACCEPTED_RESUME_EXTENSIONS,
  LEGACY_DOC_MESSAGE,
} from "@/features/resume";

type ResumeUploadStepProps = {
  isDragging: boolean;
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
  isSubmitting: boolean;
  onAnalyze: () => void;
  onDropFile: (file: File) => void;
  onRemoveFile: () => void;
  onDragStateChange: (dragging: boolean) => void;
};

export function ResumeUploadStep({
  isDragging,
  fileName,
  fileSize,
  error,
  isSubmitting,
  onAnalyze,
  onDropFile,
  onRemoveFile,
  onDragStateChange,
}: ResumeUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const isAnalyzeDisabled = !fileName || !!error || isSubmitting;
  const formattedFileSize = useMemo(() => {
    if (!fileSize) return null;
    if (fileSize < 1024 * 1024) {
      return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
    }

    return `${(fileSize / 1024 / 1024).toFixed(2)} MB`;
  }, [fileSize]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onDropFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onDragStateChange(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onDropFile(file);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
          Step 2 of 4
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Upload your resume
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          Upload a PDF or DOCX resume. CareerOS will extract text and build your
          initial profile.
        </p>
      </header>

      <div
        className={`rounded-[var(--radius-xl)] border border-dashed p-6 text-center [transition:var(--motion-fade)] ${
          isDragging
            ? "border-[var(--color-champagne)] bg-[var(--color-champagne-muted)]"
            : "border-[var(--color-border-subtle)] bg-[var(--surface-inset)]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragStateChange(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          accept={ACCEPTED_RESUME_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={handleInputChange}
          type="file"
        />

        <p className="text-sm text-[var(--color-text-primary)]">
          Drag and drop your resume here
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Accepted: PDF, DOCX. Maximum file size: 5 MB.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {LEGACY_DOC_MESSAGE}
        </p>

        <button
          className="btn-secondary mt-5"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose file
        </button>
      </div>

      {fileName ? (
        <div className="surface-card p-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{fileName}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {formattedFileSize}
          </p>
          <button
            className="mt-3 text-xs text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            onClick={onRemoveFile}
            type="button"
          >
            Remove file
          </button>
        </div>
      ) : null}

      <div aria-live="polite">
        {error ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {error}
          </p>
        ) : null}
      </div>

      <button
        className="btn-primary w-full"
        disabled={isAnalyzeDisabled}
        onClick={onAnalyze}
        type="button"
      >
        Analyze resume
      </button>
    </section>
  );
}

