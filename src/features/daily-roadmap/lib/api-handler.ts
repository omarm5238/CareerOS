import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";

import { DailyRoadmapAccessError, toDailyRoadmapErrorResponse } from "../errors";

export async function requireDailyRoadmapUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export function handleDailyRoadmapError(error: unknown) {
  const mapped = toDailyRoadmapErrorResponse(error);
  if (mapped) return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  if (error instanceof DailyRoadmapAccessError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ message: "Could not complete this request." }, { status: 500 });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
