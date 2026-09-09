import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";

import { toExecutionErrorResponse } from "../lib/permissions";

export async function requireExecutionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export function handleExecutionError(error: unknown) {
  const mapped = toExecutionErrorResponse(error);
  if (mapped) return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "CONFLICT") return NextResponse.json({ message: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  return NextResponse.json({ message: "Could not complete this request." }, { status: 500 });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
