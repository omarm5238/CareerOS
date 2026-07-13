import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import type { AnalyticsModuleData } from "../types";
import { AnalyticsEmptyState } from "./analytics-empty-state";
import { AnalyticsOverviewPanel } from "./analytics-overview-panel";
import { AnalyticsRecommendationsPanel } from "./analytics-recommendations-panel";
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
      <WorkspaceModuleLayout activeModule="Analytics" title="Analytics Module">
        <AnalyticsEmptyState />
      </WorkspaceModuleLayout>
    );
  }

  return (
    <WorkspaceModuleLayout activeModule="Analytics" title="Analytics Module">
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

        <div className="relative mx-auto max-w-6xl px-6 py-8 lg:px-8 lg:py-10">
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
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <CareerHealthPanel careerHealth={data.careerHealth} />
            <AnalyticsOverviewPanel data={data} />
            <div className="grid gap-6 lg:grid-cols-2">
              <ResumeAnalyticsPanel resume={data.resume} />
              <JobsAnalyticsPanel jobs={data.jobs} />
            </div>
            <SkillsAnalyticsPanel skills={data.skills} />
            <AnalyticsRecommendationsPanel recommendations={data.recommendations} />
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
