import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { dismissDiscoveredJob } from "@/features/jobs/discovery/lib/dismiss-discovered-job";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ discoveredJobId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { discoveredJobId } = await params;
  let reason: string | undefined;
  try {
    const body = await request.json();
    reason = typeof body?.reason === "string" ? body.reason : undefined;
  } catch { /* no body */ }

  const ok = await dismissDiscoveredJob(session.user.id, discoveredJobId, reason);
  if (!ok) return NextResponse.json({ message: "Not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}
