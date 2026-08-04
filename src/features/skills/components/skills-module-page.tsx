import Link from "next/link";
import { Suspense } from "react";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ScrollToTopOnJobContextChange } from "@/features/jobs/components/scroll-to-top-on-job-context-change";
import { TargetJobContextBar } from "@/features/jobs/components/target-job-context-bar";
import { shortJobDisplayTitle } from "@/features/skills/lib/build-selected-job-project-ideas";

import type { SkillsModuleData } from "../types";
import { AiSkillsStrategyPanel } from "./ai-skills-strategy-panel";
import { JobsSkillsSignalPanel } from "./jobs-skills-signal-panel";
import { PrioritySkillsPanel } from "./priority-skills-panel";
import { SkillGapsPanel } from "./skill-gaps-panel";
import { SkillsCategorySection } from "./skills-category-section";
import { SkillsEmptyState } from "./skills-empty-state";
import { SkillsOverviewPanel } from "./skills-overview-panel";
import { RequirementsAndProjectsPanel } from "./requirements-and-projects-panel";

type SkillsModulePageProps = {
  data: SkillsModuleData;
};

export function SkillsModulePage({ data }: SkillsModulePageProps) {
  if (!data.hasResume || !data.overview) {
    return (
      <WorkspaceModuleLayout title="Skills Module">
        <SkillsEmptyState variant="no-resume" />
      </WorkspaceModuleLayout>
    );
  }

  const { overview } = data;
  const hasDetectedSkills = overview.detectedSkills.length > 0;
  const hasJobs = data.targetJobContext.hasJobs;
  const selectedShortTitle =
    data.scopeMode === "selected_job"
      ? shortJobDisplayTitle(data.targetJobContext.selectedJobTitle) ??
        data.targetJobContext.selectedJobTitle
      : null;

  return (
    <WorkspaceModuleLayout title="Skills Module">
      <Suspense fallback={null}>
        <ScrollToTopOnJobContextChange />
      </Suspense>
      <div className="relative min-h-0 flex-1 overflow-y-auto" data-job-context-scroll>
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
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                Skills Module
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Skills Module
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {hasJobs
                  ? data.scopeMode === "selected_job"
                    ? `Target job: ${selectedShortTitle} · ${data.targetJobContext.selectedJobCompany}`
                    : "Understand repeated skills and gaps across all saved target jobs."
                  : "Review skills detected from your resume. Add a target job to unlock market benchmarking."}
              </p>
              {data.resumeRole ? (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Profile: {data.resumeRole}
                  {data.resumeExperienceLevel ? ` · ${data.resumeExperienceLevel}` : ""}
                </p>
              ) : null}
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <TargetJobContextBar
              basePath="/workspace/skills"
              context={data.targetJobContext}
              allJobsMode={data.scopeMode === "all_jobs"}
            />
            <SkillsOverviewPanel overview={overview} />

            <AiSkillsStrategyPanel
              hasJobs={hasJobs}
              insight={data.insight}
              selectedJobMode={data.scopeMode === "selected_job"}
            />

            {!hasDetectedSkills ? (
              <SkillsEmptyState variant="no-detected-skills" />
            ) : (
              <SkillsCategorySection groupedSkills={overview.groupedSkills} />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <PrioritySkillsPanel
                items={overview.prioritySkills}
                selectedJobTitle={selectedShortTitle}
              />
              <SkillGapsPanel
                hasJobs={hasJobs}
                missingSkillJobCounts={overview.missingSkillJobCounts}
                missingSkills={overview.missingSkillsFromJobs}
                selectedJobLabel={selectedShortTitle}
              />
            </div>
            <RequirementsAndProjectsPanel
              overview={overview}
              selectedJobMode={data.scopeMode === "selected_job"}
            />

            <JobsSkillsSignalPanel
              hasJobs={hasJobs}
              matchedSkills={overview.matchedSkillsFromJobs}
              missingSkills={overview.missingSkillsFromJobs}
            />

            <section
              aria-labelledby="skills-recommendations-heading"
              className="surface-glass p-5"
            >
              <h2
                className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
                id="skills-recommendations-heading"
              >
                Recommendations
              </h2>
              <ul className="mt-4 space-y-2">
                {overview.recommendations.map((item) => (
                  <li
                    className="flex gap-2 text-sm leading-6 text-[var(--color-text-secondary)]"
                    key={item}
                  >
                    <span aria-hidden="true" className="text-[var(--color-accent)]">
                      ·
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
