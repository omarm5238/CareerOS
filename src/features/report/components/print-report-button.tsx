"use client";

export function PrintReportButton() {
  return (
    <button
      className="btn-secondary print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      Print / Save as PDF
    </button>
  );
}
