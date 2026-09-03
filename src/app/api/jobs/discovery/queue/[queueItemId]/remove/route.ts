import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { removeQueueItem } from "@/features/jobs/queue/lib/remove-queue-item";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ queueItemId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { queueItemId } = await params;
  const ok = await removeQueueItem(session.user.id, queueItemId);

  if (!ok) return NextResponse.json({ message: "Not found or cannot remove." }, { status: 404 });
  return NextResponse.json({ success: true });
}
