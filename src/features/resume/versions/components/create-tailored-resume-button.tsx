"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateTailoredResumeButtonProps = {
  jobId: string;
  label?: string;
};

export function CreateTailoredResumeButton({
  jobId,
  label = "Create tailored resume",
}: CreateTailoredResumeButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCreate() {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/resume/versions/create-for-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetJobId: jobId }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        versionId?: string;
      } | null;

      if (!response.ok || !body?.versionId) {
        throw new Error(body?.message ?? "Could not create a tailored resume.");
      }

      setSuccess(body.message ?? "Tailored resume draft created.");
      router.push(`/workspace/resume/versions/${body.versionId}`);
      router.refresh();
    } catch (createError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "resume-version-create-for-job",
          message:
            createError instanceof Error ? createError.message : "Create failed",
        });
      }

      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create a tailored resume. Please try again.",
      );
      setIsCreating(false);
    }
  }

  return (
    <div>
      <button
        className="btn-primary"
        disabled={isCreating}
        onClick={() => void handleCreate()}
        type="button"
      >
        {isCreating ? "Tailoring resume…" : label}
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
