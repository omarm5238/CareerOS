import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { MemoryPageClient } from "@/features/career-memory/components/memory-page";
import { getCareerMemoryWorkspace } from "@/features/career-memory/server";
import { auth } from "@/server/auth";

export default async function CareerMemoryRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getCareerMemoryWorkspace(session.user.id);
  return (
    <WorkspaceModuleLayout title="Memory" subtitle="Long-term career memory">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <MemoryPageClient initial={data} />
      </div>
    </WorkspaceModuleLayout>
  );
}
