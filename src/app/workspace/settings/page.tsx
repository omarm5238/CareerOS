import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SettingsModulePage } from "@/features/settings/components/settings-module-page";
import { getSettingsModuleDataForUser } from "@/features/settings/server";
import { auth } from "@/server/auth";

export default async function WorkspaceSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const data = await getSettingsModuleDataForUser(session.user.id);

  return <SettingsModulePage data={data} />;
}
