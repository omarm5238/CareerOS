import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { addToQueue } from "@/features/jobs/queue/lib/add-to-queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ discoveredJobId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { discoveredJobId } = await params;

  try {
    const result = await addToQueue(session.user.id, discoveredJobId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
