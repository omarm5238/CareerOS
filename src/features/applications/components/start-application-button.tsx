"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StartApplicationButtonProps = {
  jobId: string;
  label?: string;
};

export function StartApplicationButton({
  jobId,
  label = "Start Application",
}: StartApplicationButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/applications/create-for-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetJobId: jobId }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        applicationId?: string;
      } | null;

      if (!response.ok || !body?.applicationId) {
        throw new Error(body?.message ?? "Could not start an application.");
      }

      router.push(`/workspace/applications/${body.applicationId}`);
      router.refresh();
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Could not start an application.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <button className="btn-primary" disabled={pending} onClick={() => void start()} type="button">
        {pending ? "Starting…" : label}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-danger,#e5a3a3)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
