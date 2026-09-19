import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";

import { toWeeklyReviewErrorResponse } from "../errors";

export async function requireWeeklyReviewUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export function handleWeeklyReviewError(error: unknown) {
  const mapped = toWeeklyReviewErrorResponse(error);
  if (mapped) return NextResponse.json({ message: mapped.message }, { status: mapped.status });
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
