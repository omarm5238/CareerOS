import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SkillsModulePage } from "@/features/skills/components/skills-module-page";
import { getSkillsModuleDataForUser } from "@/features/skills/server";
import { auth } from "@/server/auth";

export default async function WorkspaceSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { jobId } = await searchParams;
  const data = await getSkillsModuleDataForUser(session.user.id, jobId);

  return <SkillsModulePage data={data} />;
}
