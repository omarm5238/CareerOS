import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApplicationsModulePage } from "@/features/applications/components/applications-module-page";
import {
  computeApplicationMetrics,
  getApplicationsForUser,
} from "@/features/applications/server";
import { APPLICATION_FILTERS } from "@/features/applications/types";
import type { ApplicationFilter } from "@/features/applications/types";
import { auth } from "@/server/auth";

type WorkspaceApplicationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveFilter(value: string | string[] | undefined): ApplicationFilter {
  if (typeof value === "string" && (APPLICATION_FILTERS as readonly string[]).includes(value)) {
    return value as ApplicationFilter;
  }
  return "active";
}

export default async function WorkspaceApplicationsPage({
  searchParams,
}: WorkspaceApplicationsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const applications = await getApplicationsForUser(session.user.id);
  const metrics = computeApplicationMetrics(applications);

  return (
    <ApplicationsModulePage
      applications={applications}
      filter={resolveFilter(params.filter)}
      metrics={metrics}
    />
  );
}
