import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import { EMPTY_RESUME_VERSION_CONTENT } from "../types";
import type { ResumeVersionDetail } from "../types";
import { ResumeVersionActions } from "./resume-version-actions";
import {
  formatResumeVersionDate,
  ResumeVersionSourceBadge,
  ResumeVersionStatusChip,
} from "./resume-version-badges";
import { ResumeVersionContentEditor } from "./resume-version-content-editor";
import {
  ResumeVersionAlignment,
  ResumeVersionChangeLog,
  ResumeVersionEvidenceNotes,
  ResumeVersionKeywordMap,
  ResumeVersionWarnings,
} from "./resume-version-insights";
import { ResumeVersionRevisionHistory } from "./resume-version-revision-history";
import { RESUME_VERSION_PRINT_CSS } from "./resume-version-print-css";

type ResumeVersionDetailPageProps = {
  version: ResumeVersionDetail;
  userName: string | null;
};

export function ResumeVersionDetailPage({
  version,
  userName,
}: ResumeVersionDetailPageProps) {
  const activeRevision = version.activeRevision;
  const content = activeRevision?.content ?? { ...EMPTY_RESUME_VERSION_CONTENT };

  return (
    <WorkspaceModuleLayout title="Resume Version">
      <style>{RESUME_VERSION_PRINT_CSS}</style>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] no-print">
          <CareerCore
            animated={false}
            className="h-full w-full"
            density="low"
            interactive={false}
            mode="workspace"
            pulse={false}
          />
        </div>

        <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
          <header className="space-y-3 no-print">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace/resume#resume-versions"
            >
              Back to Resume
            </Link>

            <div>
              <p className="section-eyebrow">Tailored Resume Version</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                {version.title}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {version.targetJobTitle
                  ? `Target job: ${version.targetJobTitle}${
                      version.targetJobCompany ? ` · ${version.targetJobCompany}` : ""
                    }`
                  : "Target job is no longer saved. This version and its snapshots are preserved."}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {version.sourceResumeFilename
                  ? `Source resume: ${version.sourceResumeFilename}`
                  : "Source resume is no longer available."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ResumeVersionStatusChip status={version.status} />
              <ResumeVersionSourceBadge
                model={activeRevision?.model ?? null}
                source={activeRevision?.source ?? null}
              />
              <span className="status-chip status-chip--mono">
                {activeRevision
                  ? `Revision ${activeRevision.revisionNumber}`
                  : "No active revision"}
              </span>
            </div>

            <p className="font-mono-meta text-[var(--color-text-secondary)]">
              Created {formatResumeVersionDate(version.createdAt)} · Updated{" "}
              {formatResumeVersionDate(version.updatedAt)}
            </p>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-6">
              <ResumeVersionAlignment
                after={version.alignmentScoreAfter}
                before={version.alignmentScoreBefore}
              />

              <ResumeVersionContentEditor
                activeRevisionId={version.activeRevisionId}
                content={content}
                printHeader={{
                  name: userName,
                  title: version.title,
                  targetJobCompany: version.targetJobCompany,
                  targetJobTitle: version.targetJobTitle,
                }}
                readOnly={version.status === "ARCHIVED"}
                versionId={version.id}
              />

              <ResumeVersionKeywordMap items={activeRevision?.keywordCoverage ?? []} />
            </div>

            <div className="space-y-6">
              <ResumeVersionActions
                canRegenerate={version.targetJobId !== null}
                hasActiveRevision={activeRevision !== null}
                status={version.status}
                versionId={version.id}
              />

              <ResumeVersionWarnings items={activeRevision?.warnings ?? []} />
              <ResumeVersionEvidenceNotes items={activeRevision?.evidenceNotes ?? []} />
              <ResumeVersionChangeLog items={activeRevision?.changeLog ?? []} />
              <ResumeVersionRevisionHistory
                activeRevisionId={version.activeRevisionId}
                revisions={version.revisions}
                versionId={version.id}
              />
            </div>
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
