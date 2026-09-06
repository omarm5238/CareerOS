import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ApplicationDetailPage } from "@/features/applications/components/application-detail-page";
import type { ApplicationResumeOption } from "@/features/applications/components/application-resume-section";
import {
  getApplicationDetailForUser,
  getLatestApplicationInsight,
} from "@/features/applications/server";
import type {
  ApplicationInsightDetail,
  ApplicationStagePrep,
} from "@/features/applications/types";
import type { ApplicationInsightType } from "@/generated/prisma/client";
import { getApplicationCommunicationSection } from "@/features/communications/server";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/server/auth";

type PageProps = {
  params: Promise<{ applicationId: string }>;
};

const INSIGHT_TYPE_FOR_STATUS: Partial<
  Record<string, { type: ApplicationInsightType; stage?: ApplicationStagePrep["stage"] }>
> = {
  DRAFT: { type: "NEXT_ACTION" },
  APPLIED: { type: "NEXT_ACTION" },
  SCREENING: { type: "SCREENING_PREP", stage: "SCREENING" },
  ASSESSMENT: { type: "ASSESSMENT_PREP", stage: "ASSESSMENT" },
  INTERVIEW: { type: "INTERVIEW_PREP", stage: "INTERVIEW" },
  OFFER: { type: "OFFER_REVIEW", stage: "OFFER" },
  REJECTED: { type: "REJECTION_ANALYSIS" },
};

export default async function WorkspaceApplicationDetailPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  const { applicationId } = await params;
  const application = await getApplicationDetailForUser(session.user.id, applicationId);

  if (!application) {
    notFound();
  }

  const insightSpec = INSIGHT_TYPE_FOR_STATUS[application.status] ?? null;

  const insight: ApplicationInsightDetail | null = insightSpec
    ? await getLatestApplicationInsight(session.user.id, application.id, insightSpec.type)
    : null;

  const resumeOptions = application.status === "DRAFT" && application.jobPostingId
    ? await loadResumeOptions(session.user.id, application.jobPostingId)
    : [];

  const communication = await getApplicationCommunicationSection(session.user.id, application.id);

  return (
    <ApplicationDetailPage
      application={application}
      communicationArchivedCount={communication?.archivedCount ?? 0}
      communicationContacts={communication?.contacts ?? []}
      communicationDrafts={communication?.drafts ?? []}
      communicationRecommendations={communication?.recommendations ?? []}
      communicationResumeOptions={
        application.resume.resumeVersionId && application.resume.resumeVersionRevisionId
          ? [
              {
                versionId: application.resume.resumeVersionId,
                versionTitle: application.resume.resumeVersionTitle ?? "Linked resume",
                versionStatus: application.resume.resumeVersionStatus ?? "DRAFT",
                revisionId: application.resume.resumeVersionRevisionId,
                revisionNumber: application.resume.revisionNumber ?? 1,
              },
            ]
          : []
      }
      insight={insight}
      insightType={insightSpec?.type ?? null}
      interviewCompleted={communication?.interviewCompleted ?? false}
      resumeOptions={resumeOptions}
    />
  );
}

async function loadResumeOptions(
  userId: string,
  jobPostingId: string,
): Promise<ApplicationResumeOption[]> {
  const versions = await prisma.resumeVersion.findMany({
    where: {
      userId,
      targetJobId: jobPostingId,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          alignmentScoreAfter: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return versions.flatMap((version) =>
    version.revisions.map((revision) => ({
      versionId: version.id,
      versionTitle: version.title,
      versionStatus: version.status,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      alignmentScoreAfter: revision.alignmentScoreAfter,
    })),
  );
}
