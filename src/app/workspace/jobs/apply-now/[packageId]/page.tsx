import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ApplicationReviewPage } from "@/features/application-packages/components/application-review-page";
import { getApplicationPackageDetail, getApplyNowData } from "@/features/application-packages/server";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";
import { auth } from "@/server/auth";

type WorkspaceApplyNowReviewPageProps = {
  params: Promise<{ packageId: string }>;
};

export default async function WorkspaceApplyNowReviewPage({ params }: WorkspaceApplyNowReviewPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { packageId } = await params;

  try {
    const [detail, applyNow] = await Promise.all([
      getApplicationPackageDetail(session.user.id, packageId),
      getApplyNowData(session.user.id),
    ]);
    const siblingIds = applyNow.cards
      .map((card) => card.packageId)
      .filter((id): id is string => Boolean(id));

    return (
      <WorkspaceModuleLayout title="Application Review">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <ApplicationReviewPage detail={detail} siblingIds={siblingIds} />
        </div>
      </WorkspaceModuleLayout>
    );
  } catch (error) {
    if (error instanceof OpportunityAccessError) notFound();
    throw error;
  }
}
