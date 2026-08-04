"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/features/auth/auth-client";

function logSignOutError(error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error && typeof error === "object" && "status" in error) {
    const fetchError = error as {
      status?: number;
      statusText?: string;
      message?: string;
    };

    console.error({
      status: fetchError.status,
      statusText: fetchError.statusText,
      message: fetchError.message,
    });
    return;
  }

  console.error({
    status: undefined,
    statusText: undefined,
    message: error instanceof Error ? error.message : "Unknown sign-out error",
  });
}

export function SignOutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        logSignOutError(result.error);
        throw new Error("Could not sign out. Please try again.");
      }

      router.push("/sign-in");
      router.refresh();
    } catch (signOutError) {
      logSignOutError(signOutError);
      setError("Could not sign out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <section
      aria-labelledby="sign-out-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="sign-out-heading"
      >
        Session
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Sign out of CareerOS on this device.
      </p>

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="btn-danger"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            {isSigningOut ? "Signing out…" : "Confirm sign out"}
          </button>
          <button
            className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            disabled={isSigningOut}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="mt-4 inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          onClick={() => setConfirming(true)}
          type="button"
        >
          Sign out
        </button>
      )}

      <div aria-live="polite">
        {error ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-accent-muted)] px-3 py-2 text-xs text-[var(--color-text-primary)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
