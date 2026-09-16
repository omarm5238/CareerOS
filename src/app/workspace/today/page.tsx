import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { TodayPageClient } from "@/features/daily-roadmap/components/today-page";
import { getTodayWorkspace } from "@/features/daily-roadmap/server";
import { auth } from "@/server/auth";

export default async function TodayRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getTodayWorkspace(session.user.id);
  return (
    <WorkspaceModuleLayout title="Today" subtitle="Daily career roadmap">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <TodayPageClient initial={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
