import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import type { TargetJobContext } from "@/features/jobs";

import { ResumeVersionsSection } from "../versions/components/resume-versions-section";
import type { ResumeVersionListItem } from "../versions/types";

import { buildResumeImprovementCenter } from "../lib/build-resume-improvement-center";
import { currentRecommendationTexts, keepCurrentImprovementItems } from "../provenance/recommendation-freshness";
import type { ActiveResumeRevision, EvidenceCatalog } from "../provenance";
import type { ResumeAnalysisHistoryItem, ResumeModuleAnalysis } from "../types";
import { ResumeProvenanceBanner } from "./resume-provenance-banner";
import { ResumeAnalysisHeader } from "./resume-analysis-header";
import { ResumeEmptyState } from "./resume-empty-state";
import { ResumeHistoryList } from "./resume-history-list";
import { ResumeImprovementCenter } from "./resume-improvement-center";
import { ResumeInsightsSection } from "./resume-insights-section";
import { ResumeMetadataSection } from "./resume-metadata-section";
import { ResumeProfileOverview } from "./resume-profile-overview";
import { ResumeReanalysisUpload } from "./resume-reanalysis-upload";
import { ResumeSkillsSection } from "./resume-skills-section";
import { ResumeSummarySection } from "./resume-summary-section";

type ResumeAnalysisPageProps = {
  analysis: ResumeModuleAnalysis | null;
  history: ResumeAnalysisHistoryItem[];
  selectedDocumentId: string | null;
  documentNotFound?: boolean;
  targetJobContext: TargetJobContext;
  versions: ResumeVersionListItem[];
  archivedVersions: ResumeVersionListItem[];
  provenance?: {
    active: ActiveResumeRevision | null;
    mode: "current" | "outdated" | "historical" | "legacy";
    catalog: EvidenceCatalog | null;
  };
};

export function ResumeAnalysisPage({
  analysis,
  history,
  selectedDocumentId,
  documentNotFound = false,
  targetJobContext,
  versions,
  archivedVersions,
  provenance = { active: null, mode: "legacy", catalog: null },
}: ResumeAnalysisPageProps) {
  const latestDocumentId = history[0]?.resumeDocumentId ?? null;
  const builtCenter = analysis
    ? buildResumeImprovementCenter({ analysis, targetJobContext })
    : null;
  const improvementCenter = builtCenter && provenance.mode === "current"
    ? {
      groups: builtCenter.groups
        .map((group) => ({ ...group, items: keepCurrentImprovementItems(group.items, provenance.catalog) }))
        .filter((group) => group.items.length > 0),
      itemCount: 0,
    }
    : builtCenter;
  if (improvementCenter && provenance.mode === "current") {
    improvementCenter.itemCount = improvementCenter.groups.reduce((sum, group) => sum + group.items.length, 0);
  }

  return (
    <WorkspaceModuleLayout title="Resume Module">
      {!analysis && history.length === 0 && versions.length === 0 ? (
        <ResumeEmptyState />
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
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
            {documentNotFound ? (
              <section className="mb-8 surface-glass p-5">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Analysis not found
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  That resume analysis could not be found, or it does not belong to your account.
                </p>
                <Link
                  className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  href="/workspace/resume"
                >
                  View latest resume analysis
                </Link>
              </section>
            ) : null}

            <ResumeProvenanceBanner
              active={provenance.active}
              analysisCreatedAt={analysis?.analyzedAt ?? null}
              mode={analysis ? provenance.mode : "legacy"}
            />

            {analysis ? (
              <>
                <ResumeAnalysisHeader analysis={analysis} />

                <p className="mt-3">
                  <a
                    className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    href="#resume-improvement-center"
                  >
                    Jump to Resume Improvement Center
                  </a>
                </p>

                <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="space-y-6">
                    <ResumeProfileOverview analysis={analysis} />
                    <ResumeSummarySection analysis={analysis} />
                    <ResumeMetadataSection analysis={analysis} />
                    <ResumeReanalysisUpload compact />
                  </div>

                  <div className="space-y-6">
                    <ResumeHistoryList
                      items={history}
                      latestDocumentId={latestDocumentId}
                      selectedDocumentId={selectedDocumentId ?? analysis.resumeDocumentId}
                    />
                    <ResumeSkillsSection skills={analysis.detectedSkills} />
                    <ResumeInsightsSection
                      strengths={analysis.strengths}
                      suggestedFocus={provenance.mode === "current" && provenance.catalog
                        ? currentRecommendationTexts(analysis.suggestedFocus, provenance.catalog)
                        : analysis.suggestedFocus}
                      weaknesses={provenance.mode === "current" && provenance.catalog
                        ? currentRecommendationTexts(analysis.weaknesses, provenance.catalog)
                        : analysis.weaknesses}
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-6">
                  <ResumeVersionsSection
                    archivedVersions={archivedVersions}
                    versions={versions}
                  />
                  {improvementCenter ? (
                    <ResumeImprovementCenter data={improvementCenter} historical={provenance.mode !== "current"} />
                  ) : null}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <ResumeReanalysisUpload />
                <ResumeHistoryList
                  items={history}
                  latestDocumentId={latestDocumentId}
                  selectedDocumentId={selectedDocumentId}
                />
                <ResumeVersionsSection
                  archivedVersions={archivedVersions}
                  versions={versions}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspaceModuleLayout>
  );
}
