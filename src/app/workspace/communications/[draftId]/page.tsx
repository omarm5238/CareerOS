import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CommunicationDraftDetailPage } from "@/features/communications/components/communication-draft-detail-page";
import { getCommunicationDraftDetailForUser } from "@/features/communications/server";
import { auth } from "@/server/auth";

type PageProps = {
  params: Promise<{ draftId: string }>;
};

export default async function WorkspaceCommunicationDetailPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const { draftId } = await params;
  const trimmed = draftId?.trim();
  if (!trimmed) {
    notFound();
  }

  const draft = await getCommunicationDraftDetailForUser(session.user.id, trimmed);
  if (!draft) {
    notFound();
  }

  return <CommunicationDraftDetailPage draft={draft} />;
}
