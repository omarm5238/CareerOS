"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LinkedinConnectButton({
  action,
  label,
}: {
  action: "start" | "reconnect" | "disconnect";
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const href =
        action === "start"
          ? "/api/linkedin/connection/start"
          : action === "reconnect"
            ? "/api/linkedin/connection/reconnect"
            : "/api/linkedin/connection/disconnect";
      const response = await fetch(href, { method: "POST" });
      const json = (await response.json()) as { message?: string; authorizationUrl?: string };
      if (!response.ok) throw new Error(json.message ?? "Request failed.");
      if (json.authorizationUrl) {
        window.location.href = json.authorizationUrl;
        return;
      }
      router.refresh();
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
        className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Working…" : label}
      </button>
      {error ? <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
