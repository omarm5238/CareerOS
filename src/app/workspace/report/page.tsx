import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ScrollToTopOnJobContextChange } from "@/features/jobs/components/scroll-to-top-on-job-context-change";
import { CareerosReportPage } from "@/features/report/components/careeros-report-page";
import { getCareerOsReportDataForUser } from "@/features/report/lib/get-careeros-report-data-for-user";
import { auth } from "@/server/auth";

export default async function WorkspaceReportRoute({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { jobId } = await searchParams;
  const data = await getCareerOsReportDataForUser(session.user.id, jobId);

  if (!data) {
    redirect("/workspace");
  }

  return (
    <WorkspaceModuleLayout title="CareerOS Report">
      <Suspense fallback={null}>
        <ScrollToTopOnJobContextChange />
      </Suspense>
      <div className="relative min-h-0 flex-1 overflow-y-auto" data-job-context-scroll>
        <CareerosReportPage data={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
