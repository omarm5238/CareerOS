"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ResumeVersionContent, ResumeVersionExperienceBullet } from "../types";
import { EvidenceStrengthChip } from "./resume-version-badges";
import { ResumeVersionPrintView } from "./resume-version-print-view";

type ResumeVersionContentEditorProps = {
  versionId: string;
  activeRevisionId: string | null;
  content: ResumeVersionContent;
  readOnly: boolean;
  printHeader: {
    name: string | null;
    title: string;
    targetJobTitle: string | null;
    targetJobCompany: string | null;
  };
};

type BulletDraft = ResumeVersionExperienceBullet;

type Draft = {
  summary: string;
  coreSkillsText: string;
  technicalSkills: { category: string; skillsText: string }[];
  experienceBullets: BulletDraft[];
  projects: BulletDraft[];
  educationText: string;
  certificationsText: string;
};

function toDraft(content: ResumeVersionContent): Draft {
  return {
    summary: content.summary,
    coreSkillsText: content.coreSkills.join("\n"),
    technicalSkills: content.technicalSkills.map((group) => ({
      category: group.category,
      skillsText: group.skills.join("\n"),
    })),
    experienceBullets: content.experienceBullets.map((bullet) => ({ ...bullet })),
    projects: content.projects.map((project) => ({ ...project })),
    educationText: content.education.join("\n"),
    certificationsText: content.certifications.join("\n"),
  };
}

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function toContent(draft: Draft): ResumeVersionContent {
  return {
    summary: draft.summary.trim(),
    coreSkills: toLines(draft.coreSkillsText),
    technicalSkills: draft.technicalSkills
      .map((group) => ({
        category: group.category.trim(),
        skills: toLines(group.skillsText),
      }))
      .filter((group) => group.category.length > 0 && group.skills.length > 0),
    experienceBullets: draft.experienceBullets.filter(
      (bullet) => bullet.tailored.trim().length > 0,
    ),
    projects: draft.projects.filter((project) => project.tailored.trim().length > 0),
    education: toLines(draft.educationText),
    certifications: toLines(draft.certificationsText),
  };
}

export function ResumeVersionContentEditor({
  versionId,
  activeRevisionId,
  content,
  readOnly,
  printHeader,
}: ResumeVersionContentEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(content));
  const [loadedRevisionId, setLoadedRevisionId] = useState(activeRevisionId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reload the draft when a new revision becomes active without remounting,
  // so the save confirmation survives the refresh that follows a save.
  if (activeRevisionId !== loadedRevisionId) {
    setLoadedRevisionId(activeRevisionId);
    setDraft(toDraft(content));
  }

  const liveContent = toContent(draft);

  async function handleSave() {
    if (isSaving || readOnly) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/resume/versions/${encodeURIComponent(versionId)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: toContent(draft) }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        revisionNumber?: number;
      } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not save your edits.");
      }

      setSuccess(body?.message ?? "Edits saved as a new revision.");
      router.refresh();
      setIsSaving(false);
    } catch (saveError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "resume-version-save-content",
          message: saveError instanceof Error ? saveError.message : "Save failed",
        });
      }

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your edits. Your current revision is unchanged.",
      );
      setIsSaving(false);
    }
  }

  function updateBullet(
    key: "experienceBullets" | "projects",
    index: number,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((bullet, bulletIndex) =>
        bulletIndex === index ? { ...bullet, tailored: value } : bullet,
      ),
    }));
  }

  return (
    <>
      <section className="surface-glass p-5 no-print" id="tailored-content">
        <p className="section-eyebrow">Tailored resume content</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          Editable sections
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Saving creates a new revision. Earlier revisions stay available in the revision
          history.
        </p>

        <div className="mt-5 space-y-6">
          <Field label="Professional Summary">
            <textarea
              className="input-field min-h-32"
              disabled={readOnly}
              onChange={(event) =>
                setDraft((current) => ({ ...current, summary: event.target.value }))
              }
              value={draft.summary}
            />
          </Field>

          <Field hint="One skill per line. Max 12." label="Core Skills">
            <textarea
              className="input-field min-h-32"
              disabled={readOnly}
              onChange={(event) =>
                setDraft((current) => ({ ...current, coreSkillsText: event.target.value }))
              }
              value={draft.coreSkillsText}
            />
          </Field>

          <Field hint="Grouped skills. One skill per line inside each group." label="Technical Skills">
            {draft.technicalSkills.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No technical skill groups in this revision.
              </p>
            ) : (
              <div className="space-y-3">
                {draft.technicalSkills.map((group, index) => (
                  <div className="surface-card p-3" key={`tech-${index}`}>
                    <input
                      className="input-field"
                      disabled={readOnly}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          technicalSkills: current.technicalSkills.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, category: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      value={group.category}
                    />
                    <textarea
                      className="input-field mt-2 min-h-24"
                      disabled={readOnly}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          technicalSkills: current.technicalSkills.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, skillsText: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      value={group.skillsText}
                    />
                  </div>
                ))}
              </div>
            )}
          </Field>

          <BulletFields
            bullets={draft.experienceBullets}
            emptyMessage="No experience bullets in this revision."
            label="Experience Bullets"
            onChange={(index, value) => updateBullet("experienceBullets", index, value)}
            readOnly={readOnly}
          />

          <BulletFields
            bullets={draft.projects}
            emptyMessage="No project bullets in this revision."
            label="Projects"
            onChange={(index, value) => updateBullet("projects", index, value)}
            readOnly={readOnly}
          />

          <Field hint="One entry per line." label="Education">
            <textarea
              className="input-field min-h-24"
              disabled={readOnly}
              onChange={(event) =>
                setDraft((current) => ({ ...current, educationText: event.target.value }))
              }
              value={draft.educationText}
            />
          </Field>

          <Field hint="One entry per line." label="Certifications">
            <textarea
              className="input-field min-h-24"
              disabled={readOnly}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  certificationsText: event.target.value,
                }))
              }
              value={draft.certificationsText}
            />
          </Field>
        </div>

        {readOnly ? (
          <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
            This version is archived. Move it back to draft to edit it again.
          </p>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              className="btn-primary"
              disabled={isSaving}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSaving ? "Saving…" : "Save edits"}
            </button>
            <button
              className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={() => {
                setDraft(toDraft(content));
                setError(null);
                setSuccess(null);
              }}
              type="button"
            >
              Reset to saved revision
            </button>
          </div>
        )}

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

      <ResumeVersionPrintView content={liveContent} header={printHeader} />
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {label}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function BulletFields({
  label,
  bullets,
  emptyMessage,
  readOnly,
  onChange,
}: {
  label: string;
  bullets: BulletDraft[];
  emptyMessage: string;
  readOnly: boolean;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <Field
      hint="Clear a bullet to remove it. Evidence strength stays as analyzed."
      label={label}
    >
      {bullets.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {bullets.map((bullet, index) => (
            <div className="surface-card p-3" key={`${label}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {bullet.source}
                </p>
                <EvidenceStrengthChip strength={bullet.evidenceStrength} />
              </div>
              <textarea
                className="input-field mt-2 min-h-24"
                disabled={readOnly}
                onChange={(event) => onChange(index, event.target.value)}
                value={bullet.tailored}
              />
              {bullet.rationale ? (
                <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-secondary)]">
                  Why: {bullet.rationale}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}
