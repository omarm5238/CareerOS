import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ResumeAnalysisPage } from "@/features/resume/components/resume-analysis-page";
import { getTargetJobContextForUser } from "@/features/jobs/server";
import {
  getLatestResumeAnalysisForUser,
  getResumeAnalysisByDocumentIdForUser,
  getResumeAnalysisHistoryForUser,
  getResumeVersionsForUser,
} from "@/features/resume/server";
import { auth } from "@/server/auth";

type WorkspaceResumePageProps = {
  searchParams: Promise<{ documentId?: string | string[] }>;
};

export default async function WorkspaceResumePage({
  searchParams,
}: WorkspaceResumePageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const rawDocumentId = params.documentId;
  const documentId =
    typeof rawDocumentId === "string" && rawDocumentId.trim().length > 0
      ? rawDocumentId.trim()
      : null;

  const [history, targetJobContext, allVersions] = await Promise.all([
    getResumeAnalysisHistoryForUser(session.user.id),
    getTargetJobContextForUser(session.user.id),
    getResumeVersionsForUser(session.user.id, { includeArchived: true }),
  ]);

  const versions = allVersions.filter((version) => version.status !== "ARCHIVED");
  const archivedVersions = allVersions.filter((version) => version.status === "ARCHIVED");

  if (documentId) {
    const selected = await getResumeAnalysisByDocumentIdForUser(
      session.user.id,
      documentId,
    );

    if (!selected) {
      return (
        <ResumeAnalysisPage
          analysis={null}
          archivedVersions={archivedVersions}
          documentNotFound
          history={history}
          selectedDocumentId={documentId}
          targetJobContext={targetJobContext}
          versions={versions}
        />
      );
    }

    return (
      <ResumeAnalysisPage
        analysis={selected}
        archivedVersions={archivedVersions}
        history={history}
        selectedDocumentId={selected.resumeDocumentId}
        targetJobContext={targetJobContext}
        versions={versions}
      />
    );
  }

  const latest = await getLatestResumeAnalysisForUser(session.user.id);

  return (
    <ResumeAnalysisPage
      analysis={latest}
      archivedVersions={archivedVersions}
      history={history}
      selectedDocumentId={latest?.resumeDocumentId ?? null}
      targetJobContext={targetJobContext}
      versions={versions}
    />
  );
}
