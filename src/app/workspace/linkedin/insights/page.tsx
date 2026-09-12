import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinInsightsPage } from "@/features/linkedin/components/linkedin-insights-page";
import {
  findLinkedinVisibilityGaps,
  getLinkedinOverview,
  listLinkedinInsights,
  recommendNextLinkedinIdeas,
} from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinInsightsRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const userId = session.user.id;
  const [insights, next, gaps, overview] = await Promise.all([
    listLinkedinInsights(userId),
    recommendNextLinkedinIdeas(userId),
    findLinkedinVisibilityGaps(userId),
    getLinkedinOverview(userId),
  ]);
  return (
    <WorkspaceModuleLayout title="LinkedIn Insights">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinInsightsPage insights={insights} next={next} gaps={gaps} overview={overview} />
      </div>
    </WorkspaceModuleLayout>
  );
}
