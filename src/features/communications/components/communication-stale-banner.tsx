"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CommunicationStaleBanner({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/regenerate`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not regenerate.");
      router.refresh();
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "Could not regenerate.");
      setPending(false);
    }
  }

  return (
    <section className="surface-glass border-[var(--color-border)] p-5" id="context-changed">
      <p className="section-eyebrow">Context changed</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Application or recipient information has changed since this revision was created. The
        existing draft has not been modified.
      </p>
      <button className="btn-primary mt-4" disabled={pending} onClick={() => void regenerate()} type="button">
        {pending ? "Regenerating…" : "Regenerate with latest context"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
