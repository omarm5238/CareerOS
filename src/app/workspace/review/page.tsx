import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ReviewPageClient } from "@/features/weekly-review/components/review-page";
import { getWeeklyReviewWorkspace } from "@/features/weekly-review/server";
import { auth } from "@/server/auth";

export default async function WeeklyReviewRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getWeeklyReviewWorkspace(session.user.id);
  return (
    <WorkspaceModuleLayout title="Review" subtitle="Weekly career momentum">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ReviewPageClient initial={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
