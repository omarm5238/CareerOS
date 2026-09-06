import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ApplyNowPage } from "@/features/application-packages/components/apply-now-page";
import { getApplyNowData } from "@/features/application-packages/server";
import { auth } from "@/server/auth";

export default async function WorkspaceApplyNowPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const data = await getApplyNowData(session.user.id);
  return (
    <WorkspaceModuleLayout title="Apply Now">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <ApplyNowPage data={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
