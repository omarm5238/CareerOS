import type { ReactNode } from "react";
import Link from "next/link";

import { groupCareerPlanWeeks } from "@/features/analytics/lib/group-career-plan-weeks";
import { ZERO_JOBS_BENCHMARKING_MESSAGE } from "@/features/shared/insights";
import { TargetJobContextBar } from "@/features/jobs/components/target-job-context-bar";
import { SelectedTargetDelta } from "@/features/shared/components/selected-target-delta";
import { shortJobDisplayTitle } from "@/features/skills/lib/build-selected-job-project-ideas";

import type { CareerOsReportData } from "../types";
import { PrintReportButton } from "./print-report-button";

type CareerosReportPageProps = {
  data: CareerOsReportData;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAnalysisSource(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "ai") return "AI Analysis";
  if (value === "rule_based") return "Rule-based fallback";
  return value;
}

function formatBriefSource(value: CareerOsReportData["briefSource"]): string {
  if (value === "ai") return "AI Brief";
  if (value === "rule_based") return "Rule-based fallback";
  return "—";
}

function AnalysisSourceBadge({ source }: { source: string | null | undefined }) {
  const label = formatAnalysisSource(source);
  const isAi = source === "ai";
  return (
    <span
      className={`status-chip status-chip--mono ${
        isAi ? "status-chip--info" : "status-chip--neutral"
      }`}
    >
      {label}
    </span>
  );
}

export function CareerosReportPage({ data }: CareerosReportPageProps) {
  const hasJobs = data.jobsSummary.savedJobsCount > 0;
  const planWeeks = groupCareerPlanWeeks(data.careerExecutionPlan);
  const selectedShort =
    data.scopeMode === "selected_job"
      ? shortJobDisplayTitle(data.targetJobContext.selectedJob?.title) ??
        data.targetJobContext.selectedJob?.title ??
        null
      : null;
  const skillCap = data.scopeMode === "selected_job" ? 3 : 5;
  const skillSummaries = data.skillsPriorityPlan.slice(0, skillCap);

  return (
    <div className="careeros-report mx-auto max-w-5xl px-6 py-8 lg:px-8 lg:py-10">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
          html, body {
            background: #fff !important;
            color: #111 !important;
          }
          body * {
            visibility: hidden;
          }
          .careeros-report,
          .careeros-report * {
            visibility: visible;
          }
          .careeros-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 180mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            color: #111 !important;
          }
          .careeros-report .no-print,
          .careeros-report .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }
          .careeros-report section {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d4d4d4 !important;
            border-radius: 6px !important;
            background: #fff !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
            margin-bottom: 6mm;
          }
          .careeros-report .surface-glass,
          .careeros-report .surface-card,
          .careeros-report .surface-panel,
          .careeros-report .surface-elevated {
            background: #fff !important;
            border-color: #d4d4d4 !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
          }
          .careeros-report .report-week {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .careeros-report table {
            width: 100%;
            border-collapse: collapse;
          }
          .careeros-report th,
          .careeros-report td {
            border-bottom: 1px solid #ddd !important;
            padding: 5px 4px !important;
            vertical-align: top;
          }
          .careeros-report h1,
          .careeros-report h2,
          .careeros-report h3,
          .careeros-report p,
          .careeros-report li,
          .careeros-report dd,
          .careeros-report dt,
          .careeros-report span,
          .careeros-report a {
            color: #111 !important;
            text-shadow: none !important;
          }
          .careeros-report h2 {
            color: #444 !important;
          }
          .careeros-report [class*="rounded-full"] {
            border: 1px solid #999 !important;
            background: #f5f5f5 !important;
            color: #222 !important;
          }
          .careeros-report a {
            text-decoration: underline;
          }
        }
      `}</style>

      <div className="no-print print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="text-xs text-[var(--color-text-secondary)] underline-offset-4 hover:underline"
          href={
            data.scopeMode === "selected_job" && data.targetJobContext.selectedJobId
              ? `/workspace/analytics?jobId=${encodeURIComponent(data.targetJobContext.selectedJobId)}`
              : "/workspace/analytics"
          }
        >
          Back to Analytics
        </Link>
        <PrintReportButton />
      </div>

      <header className="surface-glass space-y-2 p-5">
        <p className="section-eyebrow">CareerOS Report</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          CareerOS Report
        </h1>
        <p className="font-mono-meta text-sm text-[var(--color-text-secondary)]">
          Generated {formatDate(data.generatedAt)} · {data.profile.name} · {data.profile.email}
        </p>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {data.scopeMode === "selected_job" && selectedShort
            ? `Report scope: Selected target job — ${selectedShort}`
            : "Report scope: All saved jobs"}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Brief source: {formatBriefSource(data.briefSource)}
        </p>
        {data.briefSource === "rule_based" ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            This report uses a provisional rule-based brief. Refresh with AI for deeper analysis.
          </p>
        ) : null}
      </header>

      <div className="mt-8 space-y-6">
        <div className="no-print">
          <TargetJobContextBar
            allJobsMode={data.scopeMode === "all_jobs"}
            basePath="/workspace/report"
            context={data.targetJobContext}
          />
        </div>

        {data.selectedTargetDelta ? (
          <SelectedTargetDelta delta={data.selectedTargetDelta} />
        ) : null}

        <ReportSection title="Career Health">
          <p className="metric-number text-3xl text-[var(--color-text-primary)]">
            {data.careerHealth.score}
            <span className="text-lg font-medium text-[var(--color-text-secondary)]">%</span>
            <span className="ml-2 text-base font-medium text-[var(--color-text-secondary)]">
              · {data.careerHealth.label}
            </span>
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {data.careerHealth.explanation}
          </p>
        </ReportSection>

        <ReportSection title="CareerOS Brief">
          {data.briefSummary ? (
            <>
              {data.briefSummary.headline ? (
                <h3 className="text-base font-medium text-[var(--color-text-primary)]">
                  {data.briefSummary.headline}
                </h3>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {data.briefSummary.summary}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No CareerOS Brief generated yet.
            </p>
          )}
        </ReportSection>

        <ReportSection title="Top Risks">
          {data.topRisks.length > 0 ? (
            <ul className="space-y-2">
              {data.topRisks.map((risk) => (
                <li className="text-sm text-[var(--color-text-secondary)]" key={risk.title}>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {risk.title}
                  </span>{" "}
                  · {risk.severity} — {risk.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No major risks identified.
            </p>
          )}
        </ReportSection>

        <ReportSection title="Next Actions">
          {data.actionCenter.length > 0 ? (
            <div className="space-y-3">
              {data.actionCenter.map((section) => (
                <div key={section.section}>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    {section.section}
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {section.items.map((item) => (
                      <li className="text-sm text-[var(--color-text-secondary)]" key={item.title}>
                        {item.title} · {item.priority} — {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Generate a CareerOS Brief to populate Action Center.
            </p>
          )}
        </ReportSection>

        <ReportSection title="Resume Improvement Center">
          {data.resumeImprovementCenter && data.resumeImprovementCenter.itemCount > 0 ? (
            <div className="space-y-4">
              {data.resumeImprovementCenter.groups.map((group) => (
                <div key={group.group}>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    {group.group}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {group.items.slice(0, 4).map((item) => (
                      <li className="text-sm text-[var(--color-text-secondary)]" key={item.id}>
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {item.title}
                        </span>{" "}
                        · {item.priority} · {item.whereToFix}
                        <br />
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No major resume fixes identified.
            </p>
          )}
        </ReportSection>

        <ReportSection title="Skill Priorities">
          {!hasJobs ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No saved jobs yet. Skill priorities require at least one target job.
            </p>
          ) : skillSummaries.length > 0 ? (
            <>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
                {data.scopeMode === "selected_job"
                  ? "Top priorities for the selected target job (summary)."
                  : "Top priorities across saved jobs (summary)."}
              </p>
              <ul className="space-y-3">
                {skillSummaries.map((item) => (
                  <li className="text-sm text-[var(--color-text-secondary)]" key={item.skill}>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {item.skill}
                    </span>
                    {item.estimatedHours ? ` · ${item.estimatedHours}` : ""}
                    <br />
                    {item.whyThisMatters || item.reason}
                    <br />
                    {item.proofProject
                      ? `Proof: ${item.proofProject}`
                      : item.learningTarget
                        ? `Action: ${item.learningTarget}`
                        : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No market-driven skill priorities yet. Save jobs and refresh Skills Strategy.
            </p>
          )}
        </ReportSection>

        <ReportSection title="30-Day Career Execution Plan">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {data.careerExecutionPlan.startDate} → {data.careerExecutionPlan.endDate} · ~
            {data.careerExecutionPlan.totalEstimatedHours}h
          </p>
          <div className="mt-4 space-y-5">
            {planWeeks.map((week, weekIndex) => (
              <div
                className="report-week overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3"
                key={week.summary?.week ?? `week-${weekIndex + 1}`}
              >
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {week.summary?.week ?? `Week ${weekIndex + 1}`}
                </h3>
                {week.summary ? (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {week.summary.focus} · {week.summary.outcome} · ~
                    {week.summary.totalHours}h
                  </p>
                ) : null}
                <table className="mt-3 min-w-[680px] text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-text-secondary)]">
                      <th>Date</th>
                      <th>Day</th>
                      <th>Category</th>
                      <th>Task</th>
                      <th>Output</th>
                      <th>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.map((day) => (
                      <tr key={`${day.date}-${day.dayNumber}`}>
                        <td>{day.displayDate}</td>
                        <td>{day.dayNumber}</td>
                        <td className="capitalize">{day.taskType}</td>
                        <td>
                          <span className="font-medium">{day.taskTitle}</span>
                          {day.taskDetails ? (
                            <span className="mt-1 block text-[var(--color-text-secondary)]">
                              {day.taskDetails}
                            </span>
                          ) : null}
                        </td>
                        <td>{day.outcome}</td>
                        <td>{day.estimatedHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Overview Metrics">
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {data.profileSummary ? (
              <>
                <Item label="Role" value={data.profileSummary.role} />
                <Item label="Level" value={data.profileSummary.level} />
                <Item label="Completeness" value={`${data.profileSummary.completeness}%`} />
                <Item
                  label="Resume analysis"
                  value={formatAnalysisSource(data.profileSummary.analysisSource)}
                />
              </>
            ) : (
              <Item label="Resume" value="No resume analysis yet" />
            )}
            <Item label="Saved jobs" value={String(data.jobsSummary.savedJobsCount)} />
            <Item
              label="Average match"
              value={
                data.jobsSummary.averageMatchScore === null
                  ? "—"
                  : `${data.jobsSummary.averageMatchScore}%`
              }
            />
            <Item
              label="Best match"
              value={
                data.jobsSummary.bestMatchScore === null
                  ? "—"
                  : `${data.jobsSummary.bestMatchScore}%`
              }
            />
            <Item label="Applied" value={String(data.jobsSummary.appliedStatusCount)} />
            <Item label="Interview" value={String(data.jobsSummary.interviewStatusCount)} />
            {data.scopeMode === "selected_job" && data.targetJobContext.selectedJob ? (
              <Item
                label="Selected match"
                value={
                  data.targetJobContext.selectedJob.analysis
                    ? `${data.targetJobContext.selectedJob.analysis.matchScore}%`
                    : "Not analyzed"
                }
              />
            ) : null}
          </dl>
          {data.profileSummary ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                Analysis source
              </span>
              <AnalysisSourceBadge source={data.profileSummary.analysisSource} />
            </div>
          ) : null}
        </ReportSection>

        <ReportSection title="Data Sources">
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <Item label="Latest resume" value={formatDate(data.freshness.latestResumeAt)} />
            <Item
              label="Latest job"
              value={hasJobs ? formatDate(data.freshness.latestJobAt) : "—"}
            />
            <Item label="Saved jobs" value={String(data.freshness.currentJobCount)} />
            <Item
              label="Target job used"
              value={
                data.scopeMode === "selected_job" && selectedShort
                  ? `${selectedShort} · ${data.targetJobContext.selectedJobCompany ?? "—"}`
                  : "All saved jobs"
              }
            />
            <Item
              label="Skills insight"
              value={
                !hasJobs
                  ? "Needs target job"
                  : data.freshness.skillsInsightStale
                    ? "Needs refresh"
                    : "Current"
              }
            />
            <Item
              label="Career brief"
              value={
                data.briefSource === null
                  ? "Not available"
                  : data.freshness.careerBriefStale
                    ? "Needs refresh"
                    : formatBriefSource(data.briefSource)
              }
            />
          </dl>
          {!hasJobs ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {ZERO_JOBS_BENCHMARKING_MESSAGE}
            </p>
          ) : null}
          {data.dataSourceNotes.length > 0 ? (
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              Data notes: {data.dataSourceNotes.join(" · ")}
            </p>
          ) : null}
        </ReportSection>

        {data.warnings.length > 0 ? (
          <ReportSection title="Warnings">
            <ul className="space-y-1">
              {data.warnings.map((warning) => (
                <li className="text-sm text-[var(--color-text-secondary)]" key={warning}>
                  {warning}
                </li>
              ))}
            </ul>
          </ReportSection>
        ) : null}
      </div>
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-glass p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
