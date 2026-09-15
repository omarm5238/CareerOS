import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinPublishReviewPage } from "@/features/linkedin/integration/components/linkedin-publish-review-page";
import { buildLinkedinPublishText } from "@/features/linkedin/integration/publishing/build-publish-text";
import { LinkedinAccessError, LinkedinIntegrationError } from "@/features/linkedin/server";
import { getSafeLinkedinConnection, prepareLinkedinOfficialPublish } from "@/features/linkedin/server";
import { assertOwnedPlan } from "@/features/linkedin/lib/permissions";
import { auth } from "@/server/auth";

type PageContext = { params: Promise<{ planId: string }> };

export default async function LinkedinPublishRoute({ params }: PageContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { planId } = await params;
  try {
    const plan = await assertOwnedPlan(session.user.id, planId);
    const connection = await getSafeLinkedinConnection(session.user.id);
    const finalText = buildLinkedinPublishText(plan.linkedinPostRevision);
    const newer = Boolean(
      plan.linkedinPost.activeRevisionId && plan.linkedinPost.activeRevisionId !== plan.linkedinPostRevisionId,
    );
    const publish = connection.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST");
    let review = null;
    let prepareError: { code: string; message: string } | null = null;
    if (publish?.state === "AVAILABLE" && (plan.status === "READY" || plan.status === "SCHEDULED")) {
      try {
        review = await prepareLinkedinOfficialPublish(session.user.id, planId);
      } catch (error) {
        if (error instanceof LinkedinIntegrationError) {
          prepareError = { code: error.code, message: error.message };
        } else if (error instanceof LinkedinAccessError) {
          prepareError = { code: error.code, message: error.message };
        } else {
          prepareError = { code: "LINKEDIN_PUBLISH_FAILED", message: "Could not prepare official publish." };
        }
      }
    }
    return (
      <WorkspaceModuleLayout title="Publish to LinkedIn" subtitle="Exact frozen revision review">
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <LinkedinPublishReviewPage
            planId={plan.id}
            revisionNumber={plan.linkedinPostRevision.revisionNumber}
            finalText={finalText}
            newerRevisionWarning={
              newer
                ? `A newer revision exists. This publishing plan still uses Revision ${plan.linkedinPostRevision.revisionNumber}.`
                : null
            }
            planStatus={plan.status}
            connection={connection}
            initialReview={review}
            prepareError={prepareError}
          />
        </div>
      </WorkspaceModuleLayout>
    );
  } catch (error) {
    if (error instanceof LinkedinAccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
