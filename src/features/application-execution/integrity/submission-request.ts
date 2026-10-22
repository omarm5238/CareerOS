import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";

export async function requireOwnedApplication(applicationId: string): Promise<
  { userId: string; applicationId: string } | { response: NextResponse }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { response: NextResponse.json({ message: "Authentication required." }, { status: 401 }) };
  }
  if (!applicationId.trim()) {
    return { response: NextResponse.json({ message: "Application ID is required." }, { status: 400 }) };
  }
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
    select: { id: true },
  });
  if (!application) {
    return { response: NextResponse.json({ message: "Application not found." }, { status: 404 }) };
  }
  return { userId: session.user.id, applicationId: application.id };
}

export function rejectClientTarget(body: Record<string, unknown>): NextResponse | null {
  if ("url" in body || "destinationUrl" in body || "targetUrl" in body || "destination" in body) {
    return NextResponse.json({ message: "A target URL cannot be supplied by the client." }, { status: 400 });
  }
  return null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
}
