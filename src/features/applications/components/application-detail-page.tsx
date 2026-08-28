import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import { allowedTransitionsFor } from "../lib/application-state";
import type {
  ApplicationDetail,
  ApplicationInsightDetail,
} from "../types";
import type { ApplicationInsightType } from "@/generated/prisma/client";
import {
  ApplicationNextActionSourceBadge,
  ApplicationStatusChip,
  describeDueDate,
  formatApplicationDate,
  formatApplicationDateTime,
} from "./application-badges";
import { ApplicationContactsSection } from "./application-contacts-section";
import { ApplicationEventForm } from "./application-event-form";
import { ApplicationFollowUp } from "./application-follow-up";
import { ApplicationNextStepCenter } from "./application-next-step-center";
import { ApplicationNotesSection } from "./application-notes-section";
import { ApplicationResumeSection } from "./application-resume-section";
import type { ApplicationResumeOption } from "./application-resume-section";
import { ApplicationStageActions } from "./application-stage-actions";
import { ApplicationTimeline } from "./application-timeline";

type ApplicationDetailPageProps = {
  application: ApplicationDetail;
  insightType: ApplicationInsightType | null;
  insight: ApplicationInsightDetail | null;
  resumeOptions: ApplicationResumeOption[];
};

const SOURCE_LABELS: Record<ApplicationDetail["source"], string> = {
  JOBS_MODULE: "Jobs module",
  MANUAL: "Manual",
  IMPORTED: "Imported",
  DISCOVERY_QUEUE: "Discovery",
};

export function ApplicationDetailPage({
  application,
  insightType,
  insight,
  resumeOptions,
}: ApplicationDetailPageProps) {
  const isClosed = application.closedAt !== null;
  const canChangeResume = application.status === "DRAFT";
  const due = describeDueDate(application.nextAction.dueAt);

  return (
    <WorkspaceModuleLayout title="Application">
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
              href="/workspace/applications"
            >
              Back to Applications
            </Link>

            <div>
              <p className="section-eyebrow">Application</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                {application.jobTitle}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {application.company}
                {application.location ? ` · ${application.location}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ApplicationStatusChip status={application.status} />
              <span className="status-chip status-chip--mono">
                {SOURCE_LABELS[application.source]}
              </span>
            </div>

            <p className="font-mono-meta text-[var(--color-text-secondary)]">
              Applied {formatApplicationDate(application.appliedAt)} · Last activity{" "}
              {formatApplicationDate(application.lastActivityAt)}
            </p>

            {application.jobUrl ? (
              <p className="text-sm">
                <Link
                  className="text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  href={application.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open job URL
                </Link>
              </p>
            ) : null}

            {!application.jobRecordAvailable ? (
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                The original saved job is no longer available. Snapshot details below are preserved.
              </p>
            ) : null}
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-6">
              <section className="surface-glass p-5" id="next-action">
                <p className="section-eyebrow">Current Next Action</p>
                {application.nextAction.title ? (
                  <>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
                      {application.nextAction.title}
                    </h2>
                    {application.nextAction.reason ? (
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {application.nextAction.reason}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ApplicationNextActionSourceBadge source={application.nextAction.source} />
                      {due ? (
                        <span className="font-mono-meta text-[var(--color-text-secondary)]">
                          {due}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    No next action is stored for this application.
                  </p>
                )}
              </section>

              {application.upcomingEvent ? (
                <section className="surface-glass p-5" id="upcoming-event">
                  <p className="section-eyebrow">Upcoming</p>
                  <h2 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                    {application.upcomingEvent.title}
                  </h2>
                  <p className="mt-1 font-mono-meta text-[var(--color-accent)]">
                    {formatApplicationDateTime(application.upcomingEvent.eventAt)}
                  </p>
                  {application.upcomingEvent.metadata.round ||
                  application.upcomingEvent.metadata.format ? (
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      {[
                        application.upcomingEvent.metadata.round,
                        application.upcomingEvent.metadata.format,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </section>
              ) : null}

              <ApplicationTimeline items={application.timeline} />
              <ApplicationEventForm applicationId={application.id} />

              <ApplicationNotesSection
                applicationId={application.id}
                companyNotes={application.companyNotes}
                documents={application.documents}
                notes={application.notes}
                salaryNotes={application.salaryNotes}
              />
            </div>

            <div className="space-y-6">
              <ApplicationStageActions
                applicationId={application.id}
                status={application.status}
                transitions={[...allowedTransitionsFor(application.status)]}
              />
              <ApplicationFollowUp
                applicationId={application.id}
                disabled={isClosed}
                followUpAt={application.followUpAt}
              />
              <ApplicationResumeSection
                applicationId={application.id}
                canChange={canChangeResume}
                hasJob={application.jobPostingId !== null}
                options={resumeOptions}
                resume={application.resume}
              />
              <ApplicationContactsSection
                applicationId={application.id}
                contacts={application.contacts}
              />
              <ApplicationNextStepCenter
                applicationId={application.id}
                insight={insight}
                insightType={insightType}
                status={application.status}
              />
            </div>
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
