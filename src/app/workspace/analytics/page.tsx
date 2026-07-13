import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AnalyticsModulePage } from "@/features/analytics/components/analytics-module-page";
import { getAnalyticsModuleDataForUser } from "@/features/analytics/server";
import { auth } from "@/server/auth";

export default async function WorkspaceAnalyticsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const data = await getAnalyticsModuleDataForUser(session.user.id);

  return <AnalyticsModulePage data={data} />;
}
