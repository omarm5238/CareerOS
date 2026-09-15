import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinSettingsPage } from "@/features/linkedin/integration/components/linkedin-settings-page";
import { getSafeLinkedinConnection } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinSettingsRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const connection = await getSafeLinkedinConnection(session.user.id);
  return (
    <WorkspaceModuleLayout title="LinkedIn Settings" subtitle="Official connection and capabilities">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinSettingsPage connection={connection} />
      </div>
    </WorkspaceModuleLayout>
  );
}
