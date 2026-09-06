"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  CommunicationLanguage,
  CommunicationLength,
  CommunicationTone,
  CommunicationType,
} from "@/generated/prisma/client";

import {
  COMMUNICATION_LANGUAGE_LABELS,
  COMMUNICATION_LANGUAGES,
  COMMUNICATION_LENGTH_LABELS,
  COMMUNICATION_LENGTHS,
  COMMUNICATION_TONE_LABELS,
  COMMUNICATION_TONES,
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPES,
  OFFER_RESPONSE_INTENT_LABELS,
  OFFER_RESPONSE_INTENTS,
  type CommunicationContactOption,
  type CommunicationRecommendation,
  type CommunicationResumeOption,
  type OfferResponseIntent,
  type RecipientMode,
} from "../types";
import { defaultLengthForType } from "../lib/derive-communication-recommendations";

type CommunicationGenerateDialogProps = {
  applicationId?: string | null;
  jobPostingId?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  applicationStatus?: string | null;
  resumeOptions: CommunicationResumeOption[];
  defaultResumeVersionId?: string | null;
  defaultResumeRevisionId?: string | null;
  contacts: CommunicationContactOption[];
  recommendations?: CommunicationRecommendation[];
  interviewCompleted?: boolean;
  defaultType?: CommunicationType;
  triggerLabel?: string;
};

export function CommunicationGenerateDialog({
  applicationId,
  jobPostingId,
  jobTitle,
  company,
  applicationStatus,
  resumeOptions,
  defaultResumeVersionId,
  defaultResumeRevisionId,
  contacts,
  recommendations = [],
  interviewCompleted = false,
  defaultType,
  triggerLabel = "Generate Message",
}: CommunicationGenerateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recommendedType = defaultType ?? recommendations.find((item) => item.primary)?.type ?? "COVER_LETTER";
  const [type, setType] = useState<CommunicationType>(recommendedType);
  const [tone, setTone] = useState<CommunicationTone>("PROFESSIONAL");
  const [length, setLength] = useState<CommunicationLength>(defaultLengthForType(recommendedType));
  const [language, setLanguage] = useState<CommunicationLanguage>("ENGLISH");
  const [offerIntent, setOfferIntent] = useState<OfferResponseIntent>("ASK_CLARIFICATION");
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null;
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(
    primaryContact ? "PRIMARY_CONTACT" : "UNKNOWN",
  );
  const [contactId, setContactId] = useState(primaryContact?.id ?? "");
  const [resumeKey, setResumeKey] = useState(() => {
    const match =
      resumeOptions.find(
        (option) =>
          option.versionId === defaultResumeVersionId &&
          option.revisionId === defaultResumeRevisionId,
      ) ?? resumeOptions[0];
    return match ? `${match.versionId}:${match.revisionId}` : "";
  });
  const [interviewConfirmed, setInterviewConfirmed] = useState(false);

  const selectedResume = useMemo(
    () => resumeOptions.find((option) => `${option.versionId}:${option.revisionId}` === resumeKey) ?? null,
    [resumeKey, resumeOptions],
  );

  const selectedContact =
    recipientMode === "SPECIFIC_CONTACT"
      ? contacts.find((contact) => contact.id === contactId) ?? null
      : recipientMode === "PRIMARY_CONTACT"
        ? primaryContact
        : null;

  const jobScoped = !applicationId;
  const availableTypes = jobScoped
    ? (["COVER_LETTER", "APPLICATION_EMAIL", "RECRUITER_OUTREACH", "GENERAL_PROFESSIONAL_MESSAGE"] as const)
    : COMMUNICATION_TYPES;

  function resetFromDefaults() {
    setType(recommendedType);
    setLength(defaultLengthForType(recommendedType));
    setError(null);
    setPending(false);
  }

  async function generate() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/communications/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: applicationId ?? null,
          jobPostingId: jobPostingId ?? null,
          contactId: selectedContact?.id ?? null,
          resumeVersionId: selectedResume?.versionId ?? defaultResumeVersionId ?? null,
          resumeVersionRevisionId: selectedResume?.revisionId ?? defaultResumeRevisionId ?? null,
          recipientMode,
          type,
          tone,
          length,
          language,
          offerIntent: type === "OFFER_RESPONSE" ? offerIntent : null,
          interviewOccurredConfirmed: type === "INTERVIEW_THANK_YOU" ? interviewConfirmed : false,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { draftId?: string; message?: string }
        | null;

      if (!response.ok || !body?.draftId) {
        throw new Error(body?.message ?? "Could not generate this communication.");
      }

      setOpen(false);
      router.push(`/workspace/communications/${body.draftId}`);
      router.refresh();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate this communication.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="btn-primary"
        onClick={() => {
          resetFromDefaults();
          setOpen(true);
        }}
        type="button"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="surface-glass max-h-[92vh] w-full max-w-xl overflow-y-auto p-5"
            role="dialog"
            aria-labelledby="generate-communication-title"
          >
            <p className="section-eyebrow">Communication</p>
            <h2
              className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
              id="generate-communication-title"
            >
              Generate Communication
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              CareerOS will draft text you can review and copy. Nothing is sent.
            </p>

            <label className="mt-5 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Type
              <select
                className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                onChange={(event) => {
                  const next = event.target.value as CommunicationType;
                  setType(next);
                  setLength(defaultLengthForType(next));
                }}
                value={type}
              >
                {availableTypes.map((value) => (
                  <option key={value} value={value}>
                    {COMMUNICATION_TYPE_LABELS[value]}
                    {recommendations.some((item) => item.type === value) ? " · Recommended" : ""}
                  </option>
                ))}
              </select>
            </label>

            {applicationId ? (
              <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Recipient
                <select
                  className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  onChange={(event) => setRecipientMode(event.target.value as RecipientMode)}
                  value={recipientMode}
                >
                  <option value="PRIMARY_CONTACT">Primary application contact</option>
                  <option value="SPECIFIC_CONTACT">Specific application contact</option>
                  <option value="HIRING_TEAM">Hiring Team</option>
                  <option value="UNKNOWN">Unknown recipient</option>
                </select>
              </label>
            ) : null}

            {recipientMode === "SPECIFIC_CONTACT" ? (
              <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Contact
                <select
                  className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  onChange={(event) => setContactId(event.target.value)}
                  value={contactId}
                >
                  {contacts.length === 0 ? <option value="">No contacts stored</option> : null}
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.role ? ` — ${contact.role}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {jobScoped && resumeOptions.length > 0 ? (
              <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Resume
                <select
                  className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  onChange={(event) => setResumeKey(event.target.value)}
                  value={resumeKey}
                >
                  {resumeOptions.map((option) => (
                    <option key={`${option.versionId}:${option.revisionId}`} value={`${option.versionId}:${option.revisionId}`}>
                      {option.versionTitle} · {option.versionStatus} · Revision {option.revisionNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedResume?.versionStatus === "DRAFT" ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                This resume has not been marked Ready. Generation can still continue.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <FieldSelect
                label="Tone"
                onChange={(value) => setTone(value as CommunicationTone)}
                options={COMMUNICATION_TONES.map((value) => ({
                  value,
                  label: COMMUNICATION_TONE_LABELS[value],
                }))}
                value={tone}
              />
              <FieldSelect
                label="Length"
                onChange={(value) => setLength(value as CommunicationLength)}
                options={COMMUNICATION_LENGTHS.map((value) => ({
                  value,
                  label: COMMUNICATION_LENGTH_LABELS[value],
                }))}
                value={length}
              />
              <FieldSelect
                label="Language"
                onChange={(value) => setLanguage(value as CommunicationLanguage)}
                options={COMMUNICATION_LANGUAGES.map((value) => ({
                  value,
                  label: COMMUNICATION_LANGUAGE_LABELS[value],
                }))}
                value={language}
              />
            </div>

            {type === "OFFER_RESPONSE" ? (
              <FieldSelect
                label="Offer intent"
                onChange={(value) => setOfferIntent(value as OfferResponseIntent)}
                options={OFFER_RESPONSE_INTENTS.map((value) => ({
                  value,
                  label: OFFER_RESPONSE_INTENT_LABELS[value],
                }))}
                value={offerIntent}
              />
            ) : null}

            {type === "INTERVIEW_THANK_YOU" && !interviewCompleted ? (
              <label className="mt-4 flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  checked={interviewConfirmed}
                  className="mt-1"
                  onChange={(event) => setInterviewConfirmed(event.target.checked)}
                  type="checkbox"
                />
                I confirm the interview has already occurred.
              </label>
            ) : null}

            <div className="mt-5 rounded-md border border-[var(--color-border)] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                CareerOS will use
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                <li>
                  {jobTitle ?? "Role unknown"}
                  {company ? ` — ${company}` : ""}
                </li>
                {applicationStatus ? <li>Application: {applicationStatus}</li> : <li>Not linked to an Application</li>}
                {selectedResume || defaultResumeRevisionId ? (
                  <li>
                    Resume: Revision {selectedResume?.revisionNumber ?? "linked"}
                    {selectedResume?.versionStatus ? ` · ${selectedResume.versionStatus}` : ""}
                  </li>
                ) : (
                  <li>Resume: none selected</li>
                )}
                <li>
                  Contact:{" "}
                  {selectedContact
                    ? `${selectedContact.name}${selectedContact.role ? ` — ${selectedContact.role}` : ""}`
                    : recipientMode === "HIRING_TEAM"
                      ? "Hiring Team"
                      : "Unknown recipient"}
                </li>
              </ul>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" disabled={pending} onClick={() => void generate()} type="button">
                {pending ? "Generating…" : "Generate"}
              </button>
              <button
                className="btn-secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
      {label}
      <select
        className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
