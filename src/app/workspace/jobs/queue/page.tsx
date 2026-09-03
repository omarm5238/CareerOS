import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApplicationQueuePage } from "@/features/jobs/queue/components/application-queue-page";
import { getQueueForUser } from "@/features/jobs/queue/lib/get-queue-for-user";
import { auth } from "@/server/auth";

export default async function WorkspaceJobsQueuePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const items = await getQueueForUser(session.user.id);

  return <ApplicationQueuePage items={items} />;
}
