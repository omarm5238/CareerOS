import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ResumeAnalysisPage } from "@/features/resume/components/resume-analysis-page";
import { getTargetJobContextForUser } from "@/features/jobs/server";
import { describeShownResume } from "@/features/resume/provenance";
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

  const [history, targetJobContext, allVersions, truth] = await Promise.all([
    getResumeAnalysisHistoryForUser(session.user.id),
    getTargetJobContextForUser(session.user.id),
    getResumeVersionsForUser(session.user.id, { includeArchived: true }),
    describeShownResume(session.user.id, documentId),
  ]);
  const labeledHistory = history.map((item) => ({
    ...item,
    truthLabel: item.analysisId === truth.current?.analysisId
      ? "Current" as const
      : item.freshness === "STALE"
        ? "Outdated" as const
        : "Historical" as const,
  }));
  const provenance = {
    active: truth.active,
    mode: truth.mode,
    catalog: truth.current?.catalog ?? null,
  };

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
          history={labeledHistory}
          provenance={provenance}
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
        history={labeledHistory}
        provenance={provenance}
        selectedDocumentId={selected.resumeDocumentId}
        targetJobContext={targetJobContext}
        versions={versions}
      />
    );
  }

  const latest = truth.current
    ? await getResumeAnalysisByDocumentIdForUser(session.user.id, truth.current.resumeDocumentId)
    : await getLatestResumeAnalysisForUser(session.user.id);

  return (
    <ResumeAnalysisPage
      analysis={latest}
      archivedVersions={archivedVersions}
      history={labeledHistory}
      provenance={provenance}
      selectedDocumentId={latest?.resumeDocumentId ?? null}
      targetJobContext={targetJobContext}
      versions={versions}
    />
  );
}
