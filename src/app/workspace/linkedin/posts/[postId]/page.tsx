import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { LinkedinPostWorkspace } from "@/features/linkedin/components/linkedin-post-workspace";
import { getLinkedinPost, LinkedinAccessError } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

type PageContext = { params: Promise<{ postId: string }> };

export default async function LinkedinPostRoute({ params }: PageContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { postId } = await params;
  try {
    const post = await getLinkedinPost(session.user.id, postId);
    return (
      <WorkspaceModuleLayout title="LinkedIn Post">
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <LinkedinPostWorkspace post={post} />
        </div>
      </WorkspaceModuleLayout>
    );
  } catch (error) {
    if (error instanceof LinkedinAccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
