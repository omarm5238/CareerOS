import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { batchAddToQueue } from "@/features/jobs/queue/lib/add-to-queue";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  let body: { discoveredJobIds?: string[]; minimumScore?: number } = {};
  try { body = await request.json(); } catch { /* empty */ }

  const ids = Array.isArray(body.discoveredJobIds) ? body.discoveredJobIds.filter((id): id is string => typeof id === "string") : [];
  const minScore = typeof body.minimumScore === "number" ? body.minimumScore : 75;

  if (ids.length === 0) {
    return NextResponse.json({ message: "No job IDs provided." }, { status: 400 });
  }

  const result = await batchAddToQueue(session.user.id, ids, minScore);
  return NextResponse.json(result);
}
