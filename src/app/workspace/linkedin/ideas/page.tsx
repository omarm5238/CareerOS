import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinIdeasPage } from "@/features/linkedin/components/linkedin-ideas-page";
import {
  findLinkedinVisibilityGaps,
  listLinkedinIdeas,
  recommendNextLinkedinIdeas,
} from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinIdeasRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const userId = session.user.id;
  const [ideas, recommendations, gaps] = await Promise.all([
    listLinkedinIdeas(userId),
    recommendNextLinkedinIdeas(userId),
    findLinkedinVisibilityGaps(userId),
  ]);
  return (
    <WorkspaceModuleLayout title="LinkedIn Ideas">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinIdeasPage ideas={ideas} recommendations={recommendations} gaps={gaps} />
      </div>
    </WorkspaceModuleLayout>
  );
}
