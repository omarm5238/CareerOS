import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { JobsModulePage } from "@/features/jobs/components/jobs-module-page";
import {
  getJobPostingByIdForUser,
  getJobPostingsForUser,
} from "@/features/jobs/server";
import {
  getJobTailoredResumeSummary,
  getLatestResumeAnalysisForUser,
} from "@/features/resume/server";
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
        />
      );
    }

    const tailoredResume = await getJobTailoredResumeSummary(session.user.id, selected.id);

    return (
      <JobsModulePage
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

  return (
    <JobsModulePage
      hasResumeProfile={!!resume}
      jobs={jobs}
      selectedJob={selectedJob}
      selectedJobId={latestId}
      tailoredResume={tailoredResume}
    />
  );
}
