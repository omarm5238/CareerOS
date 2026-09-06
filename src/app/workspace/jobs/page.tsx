import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { JobsModulePage } from "@/features/jobs/components/jobs-module-page";
import {
  getJobPostingByIdForUser,
  getJobPostingsForUser,
} from "@/features/jobs/server";
import { getApplicationSummaryForJob } from "@/features/applications/server";
import {
  getJobTailoredResumeSummary,
  getLatestResumeAnalysisForUser,
} from "@/features/resume/server";
import {
  getJobCommunications,
  getJobResumeOptionsForCommunication,
} from "@/features/communications/server";
import { auth } from "@/server/auth";

type WorkspaceJobsPageProps = {
  searchParams: Promise<{ jobId?: string | string[] }>;
};

export default async function WorkspaceJobsPage({ searchParams }: WorkspaceJobsPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const rawJobId = params.jobId;
  const jobId =
    typeof rawJobId === "string" && rawJobId.trim().length > 0 ? rawJobId.trim() : null;

  const [jobs, resume] = await Promise.all([
    getJobPostingsForUser(session.user.id),
    getLatestResumeAnalysisForUser(session.user.id),
  ]);

  if (jobId) {
    const selected = await getJobPostingByIdForUser(session.user.id, jobId);

    if (!selected) {
      return (
        <JobsModulePage
          hasResumeProfile={!!resume}
          jobNotFound
          jobs={jobs}
          selectedJob={null}
          selectedJobId={jobId}
          tailoredResume={null}
          applicationSummary={null}
        />
      );
    }

    const tailoredResume = await getJobTailoredResumeSummary(session.user.id, selected.id);
    const applicationSummary = await getApplicationSummaryForJob(session.user.id, selected.id);
    const [communicationResumeOptions, communicationDrafts] = await Promise.all([
      getJobResumeOptionsForCommunication(session.user.id, selected.id),
      getJobCommunications(session.user.id, selected.id),
    ]);

    return (
      <JobsModulePage
        applicationSummary={applicationSummary}
        communicationDrafts={communicationDrafts}
        communicationResumeOptions={communicationResumeOptions}
        hasResumeProfile={!!resume}
        jobs={jobs}
        selectedJob={selected}
        selectedJobId={selected.id}
        tailoredResume={tailoredResume}
      />
    );
  }

  const latestId = jobs[0]?.id ?? null;
  const selectedJob = latestId
    ? await getJobPostingByIdForUser(session.user.id, latestId)
    : null;
  const tailoredResume = selectedJob
    ? await getJobTailoredResumeSummary(session.user.id, selectedJob.id)
    : null;
  const applicationSummary = selectedJob
    ? await getApplicationSummaryForJob(session.user.id, selectedJob.id)
    : null;
  const communicationResumeOptions = selectedJob
    ? await getJobResumeOptionsForCommunication(session.user.id, selectedJob.id)
    : [];
  const communicationDrafts = selectedJob
    ? await getJobCommunications(session.user.id, selectedJob.id)
    : [];

  return (
    <JobsModulePage
      applicationSummary={applicationSummary}
      communicationDrafts={communicationDrafts}
      communicationResumeOptions={communicationResumeOptions}
      hasResumeProfile={!!resume}
      jobs={jobs}
      selectedJob={selectedJob}
      selectedJobId={latestId}
      tailoredResume={tailoredResume}
    />
  );
}
