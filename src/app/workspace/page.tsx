import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceJobsStatusForUser } from "@/features/jobs/server";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { getWorkspaceSkillsStatusForUser } from "@/features/skills/server";
import { auth } from "@/server/auth";

export default async function WorkspacePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const [profile, jobsStatus, skillsStatus] = await Promise.all([
    getLatestResumeAnalysisForUser(session.user.id),
    getWorkspaceJobsStatusForUser(session.user.id),
    getWorkspaceSkillsStatusForUser(session.user.id),
  ]);

  return (
    <WorkspaceShell jobsStatus={jobsStatus} profile={profile} skillsStatus={skillsStatus} />
  );
}
