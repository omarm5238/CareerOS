import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { upsertDiscoveryProfile } from "@/features/jobs/discovery/lib/update-discovery-profile";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const profile = await getDiscoveryProfileForUser(session.user.id);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid JSON." }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Invalid body." }, { status: 400 });
  }

  await upsertDiscoveryProfile(session.user.id, body as Record<string, unknown>);
  const updated = await getDiscoveryProfileForUser(session.user.id);
  return NextResponse.json({ profile: updated });
}
