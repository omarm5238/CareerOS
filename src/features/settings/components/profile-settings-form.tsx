"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { validateProfileUpdate } from "@/features/settings";
import type { UserProfile } from "@/features/settings";

type ProfileSettingsFormProps = {
  profile: UserProfile;
};

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    setName(profile.name);
    setError(null);
    setSuccess(null);
    setStatus("idle");
  }, [profile.id, profile.name, profile.updatedAt]);

  const isSaving = status === "saving";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const validation = validateProfileUpdate({ name });
    if (!validation.valid) {
      setError(validation.message);
      setSuccess(null);
      return;
    }

    setStatus("saving");
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(validation.data),
      });

      const body = (await response.json().catch(() => null)) as
        | UserProfile
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "message" in body && body.message
            ? body.message
            : "Could not update profile. Please try again.",
        );
      }

      if (!body || !("name" in body)) {
        throw new Error("Profile update returned an invalid response.");
      }

      setName(body.name);
      setSuccess("Profile updated.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not update profile. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section
      aria-labelledby="profile-settings-heading"
      className="surface-glass p-5"
    >
      <h2 className="section-eyebrow" id="profile-settings-heading">
        Profile
      </h2>

      <form className="mt-4 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)]" htmlFor="profile-name">
            Display name
          </label>
          <input
            className="input-field mt-1"
            id="profile-name"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-secondary)]" htmlFor="profile-email">
            Email
          </label>
          <input
            aria-readonly="true"
            className="input-field mt-1 opacity-70"
            id="profile-email"
            readOnly
            type="email"
            value={profile.email}
          />
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Email cannot be changed in this version.
          </p>
        </div>

        <button
          className="btn-primary"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save profile"}
        </button>

        <div aria-live="polite">
          {error ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
              {success}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
