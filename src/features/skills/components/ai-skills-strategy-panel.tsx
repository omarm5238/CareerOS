import Link from "next/link";

import { ZERO_JOBS_BENCHMARKING_MESSAGE } from "@/features/shared/insights";
import { estimateLearningEffort } from "@/features/shared/insights";

import type { SkillsInsightView } from "../types";
import { GenerateSkillsInsightButton } from "./generate-skills-insight-button";
import { SkillsInsightSourceBadge } from "./skills-insight-source-badge";

type AiSkillsStrategyPanelProps = {
  insight: SkillsInsightView | null;
  hasJobs: boolean;
  selectedJobMode?: boolean;
};

function formatGeneratedDate(value: string | null): string {
  if (!value) return "Not generated yet";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function priorityClass(priority: string): string {
  if (priority === "High") {
    return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
  }
  if (priority === "Medium") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  }
  return "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";
}

function evidenceLabel(status: string): string {
  if (status === "missing_from_resume") return "Missing from resume";
  if (status === "partially_supported") return "Partially supported";
  if (status === "supported") return "Supported";
  return "Needs proof first";
}

export function AiSkillsStrategyPanel({
  insight,
  hasJobs,
  selectedJobMode = false,
}: AiSkillsStrategyPanelProps) {
  const showMarketContent =
    hasJobs && !selectedJobMode && !!insight && insight.prioritySkills.length > 0;
  const showEmptyJobsState = !hasJobs;

  if (selectedJobMode && hasJobs) {
    return (
      <section
        aria-labelledby="ai-skills-strategy-heading"
        className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_48%)] px-4 py-3 backdrop-blur-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
                id="ai-skills-strategy-heading"
              >
                All-jobs AI strategy
              </h2>
              {insight ? (
                <SkillsInsightSourceBadge
                  isStale={insight.isStale}
                  source={insight.analysisSource}
                />
              ) : null}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              All-jobs AI strategy is available as reference. Live guidance below is scoped to the
              selected target job.
            </p>
            {insight ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Last generated: {formatGeneratedDate(insight.generatedAt)}
                {insight.jobCount > 0
                  ? ` · Based on ${insight.jobCount} saved job${insight.jobCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)]">
                No all-jobs strategy generated yet.
              </p>
            )}
          </div>
          <GenerateSkillsInsightButton
            allJobsLabel
            analysisSource={insight?.analysisSource ?? null}
            hasInsight={!!insight}
          />
        </div>
        {insight ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[var(--color-accent)] underline-offset-4 hover:underline">
              Show all-jobs strategy
            </summary>
            <div className="mt-3 space-y-3 border-t border-[var(--color-border-subtle)] pt-3">
              {insight.isStale ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Needs refresh because saved jobs changed since this strategy was generated.
                </p>
              ) : null}
              {insight.prioritySkills.slice(0, 3).map((item) => (
                <p className="text-xs text-[var(--color-text-secondary)]" key={item.skill}>
                  <span className="font-medium text-[var(--color-text-primary)]">{item.skill}</span>
                  {" · "}
                  {item.whyThisMatters || item.reason}
                </p>
              ))}
              {insight.prioritySkills.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  No all-jobs priorities stored yet.
                </p>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ai-skills-strategy-heading"
      className="surface-glass p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
            id="ai-skills-strategy-heading"
          >
            AI Skills Strategy
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Market-driven skill priorities with why they matter, what to learn, proof projects, and
            honest resume rules.
          </p>
          {hasJobs ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              AI strategy: all saved jobs. Live selected-job priorities are shown separately.
            </p>
          ) : null}
        </div>

        {hasJobs ? (
          <GenerateSkillsInsightButton
            allJobsLabel
            analysisSource={insight?.analysisSource ?? null}
            hasInsight={!!insight}
          />
        ) : (
          <button
            className="inline-flex cursor-not-allowed surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] opacity-60"
            disabled
            type="button"
          >
            Add a job first
          </button>
        )}
      </div>

      {showEmptyJobsState ? (
        <div className="mt-5 space-y-3 surface-card p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {ZERO_JOBS_BENCHMARKING_MESSAGE}
          </p>
          <Link
            className="inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace/jobs"
          >
            Go to Jobs module
          </Link>
          {insight?.isStale ? (
            <p className="text-sm text-[var(--status-warning-text)]">
              Needs refresh. Saved jobs changed since this strategy was generated.
            </p>
          ) : null}
        </div>
      ) : null}

      {insight && hasJobs ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <SkillsInsightSourceBadge
              isStale={insight.isStale}
              source={insight.analysisSource}
            />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Last generated: {formatGeneratedDate(insight.generatedAt)}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Coverage: {insight.skillCoverageScore}%
            </p>
            {insight.jobCount > 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Based on {insight.jobCount} saved job{insight.jobCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          {insight.isStale ? (
            <div className="surface-insight p-4">
              <p className="text-sm font-medium text-[var(--status-warning-text)]">Needs refresh</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Saved jobs changed since this strategy was generated. Refresh to update all-jobs
                recommendations.
              </p>
            </div>
          ) : null}

          {insight.warnings.length > 0 ? (
            <div className="surface-insight p-4">
              <h3 className="text-sm font-medium text-[var(--status-warning-text)]">Insights</h3>
              <ul className="mt-2 space-y-1.5">
                {insight.warnings.map((warning) => (
                  <li className="text-sm leading-5 text-[var(--color-text-secondary)]" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showMarketContent ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Priority Skills
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.prioritySkills.map((item) => (
                  <li
                    className="surface-card p-4"
                    key={item.skill}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.skill}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                        {evidenceLabel(item.evidenceStatus)}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Why this matters</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">
                          {item.whyThisMatters}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Current evidence</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">
                          {item.currentEvidence}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Learning target</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">
                          {item.learningTarget}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Proof project</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">
                          {item.proofProject}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Estimated hours</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">
                          {(() => {
                            const effort = estimateLearningEffort(item.skill);
                            return effort.showHours ? effort.label : "Not a short study task";
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-[0.1em]">Resume rule</dt>
                        <dd className="mt-1 text-[var(--color-text-primary)]">{item.resumeRule}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Save and analyze a target job before generating skill priorities.
            </p>
          )}

          {insight.learningRoadmap.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Learning Roadmap
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.learningRoadmap.map((item) => (
                  <li
                    className="surface-card p-4"
                    key={item.title}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {item.timeframe}
                    </p>
                    {item.skills.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.skills.map((skill) => (
                          <span
                            className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.outcome}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.projectIdeas.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Project Ideas
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.projectIdeas.slice(0, 4).map((item) => (
                  <li
                    className="surface-card p-4"
                    key={item.title}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.title}
                    </p>
                    {item.description ? (
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        {item.description}
                      </p>
                    ) : null}
                    {(item.skillsCovered ?? item.skills).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(item.skillsCovered ?? item.skills).map((skill) => (
                          <span
                            className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {item.output ? (
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Output: {item.output}
                      </p>
                    ) : null}
                    {item.estimatedHours ? (
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Estimated hours: {item.estimatedHours}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      {item.resumeProof ?? item.proof}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.resumeSkillAdvice.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Resume Skill Advice
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.resumeSkillAdvice.map((item) => (
                  <li
                    className="surface-card p-4"
                    key={item.skill}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.skill}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                        {item.action}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.advice}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.marketSignals.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Market Signals
              </h3>
              <ul className="mt-3 space-y-2">
                {insight.marketSignals.map((signal) => (
                  <li
                    className="flex gap-2 text-sm leading-6 text-[var(--color-text-secondary)]"
                    key={signal}
                  >
                    <span aria-hidden="true" className="text-[var(--color-accent)]">
                      ·
                    </span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!insight && hasJobs ? (
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          No skills strategy generated yet. Click Generate AI strategy to create personalized
          guidance from your resume and saved jobs.
        </p>
      ) : null}
    </section>
  );
}
