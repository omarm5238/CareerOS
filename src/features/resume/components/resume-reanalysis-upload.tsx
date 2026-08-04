"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ACCEPTED_RESUME_EXTENSIONS,
  LEGACY_DOC_MESSAGE,
  validateResumeFile,
} from "@/features/resume";
import type { ResumeAnalysisResult } from "@/features/resume";

type ResumeReanalysisUploadProps = {
  compact?: boolean;
};

export function ResumeReanalysisUpload({ compact = false }: ResumeReanalysisUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");

  const isAnalyzing = status === "analyzing";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateResumeFile({
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    if (!validation.valid) {
      setSelectedFile(null);
      setError(validation.message);
      setStatus("idle");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    setError(null);
    setStatus("idle");
  }

  function clearSelection() {
    setSelectedFile(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleAnalyze() {
    if (!selectedFile || isAnalyzing) return;

    setStatus("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/resume/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const body = (await response.json().catch(() => null)) as
        | (ResumeAnalysisResult & { resumeDocumentId?: string; analysisId?: string })
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "message" in body && body.message
            ? body.message
            : "Resume analysis failed. Please try again.",
        );
      }

      if (!body || !("role" in body)) {
        throw new Error("Resume analysis returned an invalid response.");
      }

      setStatus("success");
      clearSelection();

      const documentId =
        "resumeDocumentId" in body && typeof body.resumeDocumentId === "string"
          ? body.resumeDocumentId
          : null;

      if (documentId) {
        router.push(`/workspace/resume?documentId=${encodeURIComponent(documentId)}`);
      } else {
        router.push("/workspace/resume");
      }
      router.refresh();
    } catch (analyzeError) {
      setStatus("idle");
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Resume analysis failed. Please try again.",
      );
    }
  }

  return (
    <section
      aria-labelledby="resume-reanalysis-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-reanalysis-heading"
      >
        {compact ? "Re-analyze resume" : "Upload & analyze"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Upload a PDF or DOCX to create a new analysis. Previous results stay in history.
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{LEGACY_DOC_MESSAGE}</p>

      <input
        ref={inputRef}
        accept={ACCEPTED_RESUME_EXTENSIONS.join(",")}
        className="sr-only"
        id="resume-reanalysis-file"
        onChange={handleFileChange}
        type="file"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label
          className="inline-flex cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-accent)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-accent)]"
          htmlFor="resume-reanalysis-file"
        >
          Choose file
        </label>

        <button
          className="btn-primary px-3 py-2 text-xs"
          disabled={!selectedFile || isAnalyzing}
          onClick={() => void handleAnalyze()}
          type="button"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze resume"}
        </button>

        {selectedFile ? (
          <button
            className="text-xs text-[var(--color-text-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            disabled={isAnalyzing}
            onClick={clearSelection}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-3 space-y-2">
        {selectedFile ? (
          <p className="text-xs text-[var(--color-text-primary)]">
            Selected: {selectedFile.name}
          </p>
        ) : null}

        {isAnalyzing ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Analyzing resume. This may take a few seconds…
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-accent-muted)] px-3 py-2 text-xs text-[var(--color-text-primary)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
