import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ResumeVersionDetailPage } from "@/features/resume/versions/components/resume-version-detail-page";
import { getResumeVersionDetailForUser } from "@/features/resume/server";
import { auth } from "@/server/auth";

type WorkspaceResumeVersionPageProps = {
  params: Promise<{ versionId: string }>;
};

export default async function WorkspaceResumeVersionPage({
  params,
}: WorkspaceResumeVersionPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { versionId } = await params;
  const trimmedId = versionId?.trim();

  if (!trimmedId) {
    notFound();
  }

  const version = await getResumeVersionDetailForUser(session.user.id, trimmedId).catch(
    () => null,
  );

  if (!version) {
    notFound();
  }

  return (
    <ResumeVersionDetailPage userName={session.user.name ?? null} version={version} />
  );
}
