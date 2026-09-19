import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ReviewDetailClient } from "@/features/weekly-review/components/review-detail-page";
import { WeeklyReviewAccessError, getWeeklyReviewById } from "@/features/weekly-review/server";
import { auth } from "@/server/auth";

export default async function WeeklyReviewDetailRoute({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { reviewId } = await params;
  try {
    const review = await getWeeklyReviewById(session.user.id, reviewId);
    return (
      <WorkspaceModuleLayout title="Review" subtitle={review.weekLabel}>
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <ReviewDetailClient initial={review} />
        </div>
      </WorkspaceModuleLayout>
    );
  } catch (error) {
    if (error instanceof WeeklyReviewAccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
