import type { JobDetailView, JobListItem } from "./index";

export type TargetJobContextMode =
  | "none"
  | "selected_job"
  | "latest_job"
  | "all_jobs";

export type TargetJobContext = {
  savedJobsCount: number;
  selectedJobId: string | null;
  selectedJob: JobDetailView | null;
  selectedJobTitle: string | null;
  selectedJobCompany: string | null;
  selectedJobCreatedAt: string | null;
  hasSelectedJob: boolean;
  hasJobs: boolean;
  mode: TargetJobContextMode;
  availableJobs: JobListItem[];
};
