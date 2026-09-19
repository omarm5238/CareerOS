"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as { message?: string; id?: string };
  if (!response.ok) throw new Error(json.message ?? "Request failed.");
  return json;
}

export function LinkedinActionButton({
  label,
  href,
  body,
  method = "POST",
  redirectTo,
}: {
  label: string;
  href: string;
  body?: unknown;
  method?: "POST" | "PATCH";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(href, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await response.json()) as { message?: string; id?: string };
      if (!response.ok) throw new Error(json.message ?? "Request failed.");
      if (redirectTo) router.push(redirectTo.replace("[id]", json.id ?? ""));
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        className="btn-secondary w-full disabled:opacity-60"
      >
        {pending ? "Working…" : label}
      </button>
      {error ? <p className="mt-1 text-xs text-[var(--status-danger-text)]">{error}</p> : null}
    </div>
  );
}

export function CopyPostButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2 text-sm"
    >
      {copied ? "Copied (not published)" : "Copy Post"}
    </button>
  );
}

export { postJson };
