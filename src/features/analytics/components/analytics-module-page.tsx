import Link from "next/link";
import { Suspense } from "react";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ScrollToTopOnJobContextChange } from "@/features/jobs/components/scroll-to-top-on-job-context-change";
import { TargetJobContextBar } from "@/features/jobs/components/target-job-context-bar";
import { SelectedTargetDelta } from "@/features/shared/components/selected-target-delta";

import { buildDeterministicActionCenter } from "../lib/build-deterministic-action-center";
import type { AnalyticsModuleData } from "../types";
import { AnalyticsEmptyState } from "./analytics-empty-state";
import { AnalyticsOverviewPanel } from "./analytics-overview-panel";
import { AnalyticsRecommendationsPanel } from "./analytics-recommendations-panel";
import { CareerosBriefPanel } from "./careeros-brief-panel";
import { CareerExecutionPlanPanel } from "./career-execution-plan-panel";
import { CareerHealthPanel } from "./career-health-panel";
import { JobsAnalyticsPanel } from "./jobs-analytics-panel";
import { ResumeAnalyticsPanel } from "./resume-analytics-panel";
import { SkillsAnalyticsPanel } from "./skills-analytics-panel";

type AnalyticsModulePageProps = {
  data: AnalyticsModuleData;
};

export function AnalyticsModulePage({ data }: AnalyticsModulePageProps) {
  if (!data.hasUsableData) {
    return (
      <WorkspaceModuleLayout title="Analytics Module">
        <AnalyticsEmptyState />
      </WorkspaceModuleLayout>
    );
  }

  const fallbackActionSections = buildDeterministicActionCenter(data);

  return (
    <WorkspaceModuleLayout title="Analytics Module">
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

        <div className="relative mx-auto max-w-6xl px-6 py-8 lg:px-8 lg:py-9">
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                Analytics Module
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Analytics Module
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Track your career readiness across resume, jobs, and skills.
              </p>
              <p className="mt-3">
                <Link
                  className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  href={
                    data.scopeMode === "selected_job" &&
                    data.targetJobContext.selectedJobId
                      ? `/workspace/report?jobId=${encodeURIComponent(data.targetJobContext.selectedJobId)}`
                      : "/workspace/report"
                  }
                >
                  View Report
                </Link>
              </p>
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <TargetJobContextBar
              basePath="/workspace/analytics"
              context={data.targetJobContext}
              allJobsMode={data.scopeMode === "all_jobs"}
            />
            {data.selectedTargetDelta ? (
              <SelectedTargetDelta delta={data.selectedTargetDelta} />
            ) : null}
            <CareerHealthPanel careerHealth={data.careerHealth} />
            <CareerosBriefPanel
              brief={data.careerBrief}
              fallbackActionSections={fallbackActionSections}
              targetJobId={data.targetJobContext.selectedJobId}
            />
            <CareerExecutionPlanPanel
              plan={data.liveExecutionPlan}
            />
            <AnalyticsOverviewPanel data={data} />
            <div className="grid gap-6 lg:grid-cols-2">
              <ResumeAnalyticsPanel resume={data.resume} />
              <JobsAnalyticsPanel jobs={data.jobs} />
            </div>
            <SkillsAnalyticsPanel
              savedJobsCount={data.jobs.savedJobsCount}
              skills={data.skills}
            />
            <AnalyticsRecommendationsPanel recommendations={data.recommendations} />
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
