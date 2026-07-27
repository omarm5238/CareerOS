"use client";

import { useState } from "react";

export function ExportWorkspaceDataButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExport() {
    if (isExporting) return;

    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/export");

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not export workspace data.");
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `careeros-export-${date}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setSuccess("Export downloaded.");
      setIsExporting(false);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not export workspace data.",
      );
      setIsExporting(false);
    }
  }

  return (
    <div>
      <button
        className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isExporting}
        onClick={() => void handleExport()}
        type="button"
      >
        {isExporting ? "Exporting…" : "Export workspace data"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-2 text-sm text-[var(--color-accent)]" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
