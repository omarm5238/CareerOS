import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinCalendarPage } from "@/features/linkedin/components/linkedin-calendar-page";
import { listLinkedinPosts } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

export default async function LinkedinCalendarRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const posts = await listLinkedinPosts(session.user.id);
  return (
    <WorkspaceModuleLayout title="LinkedIn Calendar">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <LinkedinCalendarPage posts={posts} />
      </div>
    </WorkspaceModuleLayout>
  );
}
