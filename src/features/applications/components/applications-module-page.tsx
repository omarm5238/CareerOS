import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import { isApplicationDue } from "../lib/get-applications-for-user";
import {
  APPLICATION_FILTER_LABELS,
  APPLICATION_FILTERS,
  ACTIVE_APPLICATION_STATUSES,
} from "../types";
import type {
  ApplicationFilter,
  ApplicationListItem,
  ApplicationMetrics,
} from "../types";
import type { ApplicationStatus } from "@/generated/prisma/client";
import {
  ApplicationStatusChip,
  describeDueDate,
  formatApplicationDate,
  formatApplicationDateTime,
} from "./application-badges";

type ApplicationsModulePageProps = {
  applications: ApplicationListItem[];
  metrics: ApplicationMetrics;
  filter: ApplicationFilter;
};

function applyFilter(
  applications: ApplicationListItem[],
  filter: ApplicationFilter,
): ApplicationListItem[] {
  const active = ACTIVE_APPLICATION_STATUSES as readonly ApplicationStatus[];

  switch (filter) {
    case "active":
      return applications.filter(
        (item) => item.closedAt === null && (active.includes(item.status) || item.status === "DRAFT"),
      );
    case "needs-action":
      return applications.filter((item) => isApplicationDue(item));
    case "interviews":
      return applications.filter(
        (item) =>
          item.upcomingEvent !== null ||
          item.status === "INTERVIEW" ||
          item.status === "ASSESSMENT" ||
          item.status === "SCREENING",
      );
    case "closed":
      return applications.filter((item) => item.closedAt !== null);
    default:
      return applications;
  }
}

export function ApplicationsModulePage({
  applications,
  metrics,
  filter,
}: ApplicationsModulePageProps) {
  const visible = applyFilter(applications, filter);

  return (
    <WorkspaceModuleLayout title="Applications Module">
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
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="section-eyebrow">Applications Module</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Application Tracker
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                What is happening with each application, what happened before, which exact resume
                revision was used, and what to do next.
              </p>
            </div>
          </header>

          <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" id="application-metrics">
            <MetricCell label="Active Applications" value={metrics.active} />
            <MetricCell label="Needs Action" value={metrics.needsAction} />
            <MetricCell label="Upcoming" value={metrics.upcoming} />
            <MetricCell label="Offers" value={metrics.offers} />
          </section>

          <nav
            aria-label="Application filters"
            className="mt-6 flex flex-wrap gap-2"
            id="application-filters"
          >
            {APPLICATION_FILTERS.map((item) => {
              const isCurrent = item === filter;
              return (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={`surface-card px-3 py-1.5 text-xs font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                    isCurrent
                      ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                  }`}
                  href={item === "active" ? "/workspace/applications" : `/workspace/applications?filter=${item}`}
                  key={item}
                >
                  {APPLICATION_FILTER_LABELS[item]}
                </Link>
              );
            })}
          </nav>

          <section className="mt-6" id="application-list">
            {applications.length === 0 ? (
              <div className="surface-glass p-6">
                <p className="section-eyebrow">No applications yet</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  No applications tracked yet. Start from a saved job to create your first
                  application.
                </p>
                <div className="mt-4">
                  <Link className="btn-primary" href="/workspace/jobs">
                    Go to Jobs module
                  </Link>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <div className="surface-glass p-6">
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  No applications match the {APPLICATION_FILTER_LABELS[filter].toLowerCase()}{" "}
                  filter right now.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((application) => (
                  <ApplicationRow application={application} key={application.id} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-glass p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mt-2 metric-number text-3xl">{value}</p>
    </div>
  );
}

function ApplicationRow({ application }: { application: ApplicationListItem }) {
  const isClosed = application.closedAt !== null;
  const due = describeDueDate(application.nextAction.dueAt);
  const followUpDue = describeDueDate(application.followUpAt);

  return (
    <li className={`surface-card p-4 ${isClosed ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
            {application.jobTitle}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{application.company}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ApplicationStatusChip status={application.status} />
          <Link
            className="surface-card px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href={`/workspace/applications/${application.id}`}
          >
            Open
          </Link>
        </div>
      </div>

      {application.status === "DRAFT" ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Preparing application — not submitted yet.
        </p>
      ) : null}

      {application.nextAction.title && !isClosed ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            Next action
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            {application.nextAction.title}
            {due ? (
              <span className="ml-2 font-mono-meta text-[var(--color-text-secondary)]">{due}</span>
            ) : null}
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetaCell
          label="Applied"
          value={application.appliedAt ? formatApplicationDate(application.appliedAt) : "Not yet"}
        />
        <MetaCell
          label="Last activity"
          value={formatApplicationDate(application.lastActivityAt)}
        />
        <MetaCell label="Follow-up" value={followUpDue ?? "None scheduled"} />
        <MetaCell
          label="Resume"
          value={
            application.resume.resumeVersionTitle
              ? `${application.resume.resumeVersionTitle} · Rev ${
                  application.resume.revisionNumber ?? "?"
                }`
              : "No resume linked"
          }
        />
      </dl>

      {application.upcomingEvent ? (
        <p className="mt-3 font-mono-meta text-[var(--color-accent)]">
          {application.upcomingEvent.title} ·{" "}
          {formatApplicationDateTime(application.upcomingEvent.eventAt)}
        </p>
      ) : null}

      {isClosed ? (
        <p className="mt-3 font-mono-meta text-[var(--color-text-secondary)]">
          Closed {formatApplicationDate(application.closedAt)}
        </p>
      ) : null}
    </li>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 font-mono-meta text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
