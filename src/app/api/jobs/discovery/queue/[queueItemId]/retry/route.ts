import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prepareQueueItem } from "@/features/jobs/queue/lib/prepare-queue-item";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ queueItemId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { queueItemId } = await params;
  const result = await prepareQueueItem(session.user.id, queueItemId);

  if (!result.ok) return NextResponse.json({ message: result.error }, { status: 400 });
  return NextResponse.json(result);
}
