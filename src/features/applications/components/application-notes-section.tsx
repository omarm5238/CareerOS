"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  APPLICATION_DOCUMENT_SOURCES,
  APPLICATION_DOCUMENT_STATUSES,
} from "../types";
import type {
  ApplicationDocumentItem,
  ApplicationDocumentSource,
  ApplicationDocumentStatus,
} from "../types";

type ApplicationNotesSectionProps = {
  applicationId: string;
  notes: string | null;
  companyNotes: string | null;
  salaryNotes: string | null;
  documents: ApplicationDocumentItem[];
};

const SOURCE_LABELS: Record<ApplicationDocumentSource, string> = {
  EMPLOYER_CONFIRMED: "Employer confirmed",
  USER_ADDED: "You added",
  AI_SUGGESTED: "AI suggested",
};

export function ApplicationNotesSection({
  applicationId,
  notes,
  companyNotes,
  salaryNotes,
  documents,
}: ApplicationNotesSectionProps) {
  const router = useRouter();
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [draftCompany, setDraftCompany] = useState(companyNotes ?? "");
  const [draftSalary, setDraftSalary] = useState(salaryNotes ?? "");
  const [draftDocuments, setDraftDocuments] = useState<ApplicationDocumentItem[]>(documents);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function addDocument() {
    setDraftDocuments((current) => [
      ...current,
      { label: "", status: "needed", source: "USER_ADDED" },
    ]);
  }

  function updateDocument(index: number, patch: Partial<ApplicationDocumentItem>) {
    setDraftDocuments((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function save() {
    if (pending) return;

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: draftNotes,
          companyNotes: draftCompany,
          salaryNotes: draftSalary,
          documents: draftDocuments.filter((item) => item.label.trim().length > 0),
        }),
      });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Those notes could not be saved.");
      }

      setSuccess(body?.message ?? "Application details saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Those notes could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-glass p-5" id="application-details">
      <p className="section-eyebrow">Application Details</p>

      <NoteField label="Application notes" onChange={setDraftNotes} value={draftNotes} />
      <NoteField
        label="Company notes"
        onChange={setDraftCompany}
        placeholder="Facts you have actually been told about this company."
        value={draftCompany}
      />
      <NoteField
        label="Salary / compensation notes"
        onChange={setDraftSalary}
        placeholder="Numbers the employer actually stated. CareerOS does not invent salary data."
        value={draftSalary}
      />

      <div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Documents
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          AI suggestions are not employer requirements.
        </p>

        {draftDocuments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            No documents tracked yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {draftDocuments.map((item, index) => (
              <li className="grid gap-2 sm:grid-cols-[1fr_8rem_10rem]" key={`${item.label}-${index}`}>
                <input
                  className="input-field text-sm"
                  onChange={(event) => updateDocument(index, { label: event.target.value })}
                  placeholder="Document name"
                  value={item.label}
                />
                <select
                  className="input-field text-sm"
                  onChange={(event) =>
                    updateDocument(index, {
                      status: event.target.value as ApplicationDocumentStatus,
                    })
                  }
                  value={item.status}
                >
                  {APPLICATION_DOCUMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  className="input-field text-sm"
                  onChange={(event) =>
                    updateDocument(index, {
                      source: event.target.value as ApplicationDocumentSource,
                    })
                  }
                  value={item.source}
                >
                  {APPLICATION_DOCUMENT_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {SOURCE_LABELS[source]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}

        <button className="btn-secondary mt-3" onClick={addDocument} type="button">
          Add document
        </button>
      </div>

      <div className="mt-5">
        <button className="btn-primary" disabled={pending} onClick={() => void save()} type="button">
          {pending ? "Saving…" : "Save details"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger,#e5a3a3)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}

function NoteField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {label}
      </span>
      <textarea
        className="input-field mt-1 min-h-20 w-full text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
