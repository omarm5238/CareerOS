import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { ExecutionPage } from "@/features/application-execution/components/execution-page";
import { ExecutionAccessError } from "@/features/application-execution/lib/permissions";
import { getExecutionSession } from "@/features/application-execution/server";
import { auth } from "@/server/auth";

export default async function WorkspaceExecutionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { sessionId } = await params;
  try {
    const view = await getExecutionSession(session.user.id, sessionId);
    return (
      <WorkspaceModuleLayout title="Assisted Application">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <ExecutionPage initial={view} />
        </div>
      </WorkspaceModuleLayout>
    );
  } catch (error) {
    if (error instanceof ExecutionAccessError) notFound();
    throw error;
  }
}
