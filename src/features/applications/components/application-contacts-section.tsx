"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApplicationContactView } from "../types";

type ApplicationContactsSectionProps = {
  applicationId: string;
  contacts: ApplicationContactView[];
};

type ContactDraft = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  notes: string;
  isPrimary: boolean;
};

const EMPTY_DRAFT: ContactDraft = {
  name: "",
  role: "",
  company: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  notes: "",
  isPrimary: false,
};

function toDraft(contact: ApplicationContactView): ContactDraft {
  return {
    name: contact.name,
    role: contact.role ?? "",
    company: contact.company ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    linkedinUrl: contact.linkedinUrl ?? "",
    notes: contact.notes ?? "",
    isPrimary: contact.isPrimary,
  };
}

export function ApplicationContactsSection({
  applicationId,
  contacts,
}: ApplicationContactsSectionProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setSuccess(null);
  }

  function startEdit(contact: ApplicationContactView) {
    setEditingId(contact.id);
    setAdding(false);
    setDraft(toDraft(contact));
    setError(null);
    setSuccess(null);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function save() {
    if (pending) return;
    if (!draft.name.trim()) {
      setError("Contact name is required.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const base = `/api/applications/${encodeURIComponent(applicationId)}/contacts`;

    try {
      const response = await fetch(
        editingId ? `${base}/${encodeURIComponent(editingId)}` : base,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            role: draft.role,
            company: draft.company,
            email: draft.email,
            phone: draft.phone,
            linkedinUrl: draft.linkedinUrl,
            notes: draft.notes,
            isPrimary: draft.isPrimary,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That contact could not be saved.");
      }

      setSuccess(body?.message ?? "Contact saved.");
      cancel();
      router.refresh();
    } catch (contactError) {
      setError(
        contactError instanceof Error ? contactError.message : "That contact could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  const showForm = adding || editingId !== null;

  return (
    <section className="surface-glass p-5" id="contacts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="section-eyebrow">Contacts</p>
        {!showForm ? (
          <button className="btn-secondary" onClick={startAdd} type="button">
            Add contact
          </button>
        ) : null}
      </div>

      {contacts.length === 0 && !showForm ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          No contacts recorded. Add the recruiter, hiring manager or interviewer when you know who
          they are.
        </p>
      ) : null}

      {contacts.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {contacts.map((contact) => (
            <li className="surface-card p-4" key={contact.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {contact.name}
                    {contact.isPrimary ? (
                      <span className="ml-2 status-chip status-chip--neutral">Primary</span>
                    ) : null}
                  </p>
                  {contact.role || contact.company ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {[contact.role, contact.company].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {contact.email || contact.phone ? (
                    <p className="mt-1 font-mono-meta text-[var(--color-text-secondary)]">
                      {[contact.email, contact.phone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {contact.notes ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      {contact.notes}
                    </p>
                  ) : null}
                </div>
                <button
                  className="surface-card px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  onClick={() => startEdit(contact)}
                  type="button"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {showForm ? (
        <div className="mt-4 surface-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
              value={draft.name}
            />
            <Field
              label="Role"
              onChange={(value) => setDraft((current) => ({ ...current, role: value }))}
              placeholder="Recruiter"
              value={draft.role}
            />
            <Field
              label="Company"
              onChange={(value) => setDraft((current) => ({ ...current, company: value }))}
              value={draft.company}
            />
            <Field
              label="Email"
              onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
              value={draft.email}
            />
            <Field
              label="Phone"
              onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
              value={draft.phone}
            />
            <Field
              label="LinkedIn URL"
              onChange={(value) => setDraft((current) => ({ ...current, linkedinUrl: value }))}
              value={draft.linkedinUrl}
            />
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Notes
            </span>
            <textarea
              className="input-field mt-1 min-h-16 w-full text-sm"
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              value={draft.notes}
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              checked={draft.isPrimary}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isPrimary: event.target.checked }))
              }
              type="checkbox"
            />
            Primary contact
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => void save()}
              type="button"
            >
              {pending ? "Saving…" : editingId ? "Save changes" : "Add contact"}
            </button>
            <button className="btn-secondary" disabled={pending} onClick={cancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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

function Field({
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
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {label}
      </span>
      <input
        className="input-field mt-1 w-full text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
