"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { MIN_JOB_DESCRIPTION_LENGTH, validateJobPostingInput } from "@/features/jobs";
import type { JobDetailView } from "@/features/jobs";

type AddJobFormProps = {
  hasResumeProfile: boolean;
};

export function AddJobForm({ hasResumeProfile }: AddJobFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");

  const isSaving = status === "saving";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const validation = validateJobPostingInput({
      title,
      company,
      location,
      jobUrl,
      source,
      description,
    });

    if (!validation.valid) {
      setError(validation.message);
      setStatus("idle");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(validation.data),
      });

      const body = (await response.json().catch(() => null)) as
        | JobDetailView
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "message" in body && body.message
            ? body.message
            : "Could not save job. Please try again.",
        );
      }

      if (!body || !("id" in body)) {
        throw new Error("Job save returned an invalid response.");
      }

      setStatus("success");
      setTitle("");
      setCompany("");
      setLocation("");
      setJobUrl("");
      setSource("");
      setDescription("");

      router.push(`/workspace/jobs?jobId=${encodeURIComponent(body.id)}`);
      router.refresh();
    } catch (submitError) {
      setStatus("idle");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save job. Please try again.",
      );
    }
  }

  return (
    <section
      aria-labelledby="add-job-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="add-job-heading"
      >
        Add Job
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Paste a job posting manually. CareerOS will run a rule-based match against your latest
        resume analysis.
      </p>
      {!hasResumeProfile ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          No resume analysis yet — matching will be limited until you analyze a resume.
        </p>
      ) : null}

      <form className="mt-4 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <Field
          id="job-title"
          label="Job title"
          onChange={setTitle}
          required
          value={title}
        />
        <Field
          id="job-company"
          label="Company"
          onChange={setCompany}
          required
          value={company}
        />
        <Field
          id="job-location"
          label="Location"
          onChange={setLocation}
          value={location}
        />
        <Field
          id="job-url"
          label="Job URL"
          onChange={setJobUrl}
          placeholder="https://"
          value={jobUrl}
        />
        <Field
          id="job-source"
          label="Source"
          onChange={setSource}
          placeholder="LinkedIn, company site…"
          value={source}
        />

        <div>
          <label
            className="block text-xs text-[var(--color-text-secondary)]"
            htmlFor="job-description"
          >
            Job description
          </label>
          <textarea
            className="input-field mt-1 min-h-36"
            id="job-description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={`Paste the full job description (min ${MIN_JOB_DESCRIPTION_LENGTH} characters)`}
            required
            value={description}
          />
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            {description.trim().length}/{MIN_JOB_DESCRIPTION_LENGTH} minimum characters
          </p>
        </div>

        <button
          className="btn-primary"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save & match"}
        </button>

        <div aria-live="polite">
          {error ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
              {error}
            </p>
          ) : null}
          {status === "success" ? (
            <p className="text-xs text-[var(--color-text-secondary)]">Job saved successfully.</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--color-text-secondary)]" htmlFor={id}>
        {label}
      </label>
      <input
        className="input-field mt-1"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value}
      />
    </div>
  );
}
