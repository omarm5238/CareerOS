import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ResumeAnalysisPage } from "@/features/resume/components/resume-analysis-page";
import {
  getLatestResumeAnalysisForUser,
  getResumeAnalysisByDocumentIdForUser,
  getResumeAnalysisHistoryForUser,
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

  const history = await getResumeAnalysisHistoryForUser(session.user.id);

  if (documentId) {
    const selected = await getResumeAnalysisByDocumentIdForUser(
      session.user.id,
      documentId,
    );

    if (!selected) {
      return (
        <ResumeAnalysisPage
          analysis={null}
          documentNotFound
          history={history}
          selectedDocumentId={documentId}
        />
      );
    }

    return (
      <ResumeAnalysisPage
        analysis={selected}
        history={history}
        selectedDocumentId={selected.resumeDocumentId}
      />
    );
  }

  const latest = await getLatestResumeAnalysisForUser(session.user.id);

  return (
    <ResumeAnalysisPage
      analysis={latest}
      history={history}
      selectedDocumentId={latest?.resumeDocumentId ?? null}
    />
  );
}
