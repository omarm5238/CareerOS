import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinOverviewPage } from "@/features/linkedin/components/linkedin-overview-page";
import { getLinkedinOverview } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinOverviewRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getLinkedinOverview(session.user.id);
  return (
    <WorkspaceModuleLayout title="LinkedIn" subtitle="Growth strategy and manual publishing">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinOverviewPage data={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
