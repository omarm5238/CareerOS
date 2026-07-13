import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SkillsModulePage } from "@/features/skills/components/skills-module-page";
import { getSkillsModuleDataForUser } from "@/features/skills/server";
import { auth } from "@/server/auth";

export default async function WorkspaceSkillsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const data = await getSkillsModuleDataForUser(session.user.id);

  return <SkillsModulePage data={data} />;
}
