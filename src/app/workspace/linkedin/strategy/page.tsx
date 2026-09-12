import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinStrategyPage } from "@/features/linkedin/components/linkedin-strategy-page";
import { getLinkedinStrategy } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinStrategyRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const strategy = await getLinkedinStrategy(session.user.id);
  return (
    <WorkspaceModuleLayout title="LinkedIn Strategy">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinStrategyPage strategy={strategy} />
      </div>
    </WorkspaceModuleLayout>
  );
}
