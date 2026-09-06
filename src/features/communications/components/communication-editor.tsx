"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CommunicationEditorProps = {
  draftId: string;
  subject: string | null;
  content: string;
  showSubject: boolean;
};

export function CommunicationEditor({
  draftId,
  subject,
  content,
  showSubject,
}: CommunicationEditorProps) {
  const router = useRouter();
  const [subjectValue, setSubjectValue] = useState(subject ?? "");
  const [contentValue, setContentValue] = useState(content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSubjectValue(subject ?? "");
    setContentValue(content);
    setError(null);
    setSuccess(null);
  }, [subject, content]);

  const dirty = subjectValue !== (subject ?? "") || contentValue !== content;

  async function save() {
    if (pending || !dirty) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: showSubject ? subjectValue : null,
          content: contentValue,
        }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Could not save changes.");
      }
      setSuccess(body?.message ?? "Saved as a new revision.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save changes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-glass p-5" id="communication-editor">
      <p className="section-eyebrow">Editor</p>
      {showSubject ? (
        <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Subject
          <input
            className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            onChange={(event) => setSubjectValue(event.target.value)}
            value={subjectValue}
          />
        </label>
      ) : null}

      <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        Body
        <textarea
          className="mt-2 min-h-[280px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-3 text-sm leading-6 text-[var(--color-text-primary)]"
          onChange={(event) => setContentValue(event.target.value)}
          value={contentValue}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending || !dirty} onClick={() => void save()} type="button">
          {pending ? "Saving…" : "Save Changes"}
        </button>
        {dirty ? (
          <span className="text-xs text-[var(--color-text-secondary)]">Unsaved changes</span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-[var(--color-accent)]" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
