import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { toApplicationErrorResponse } from "@/features/applications/lib/application-permissions";
import { toOpportunityErrorResponse } from "@/features/jobs/opportunities/lib/permissions";
import { auth } from "@/server/auth";

export async function requireSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export function handleOpportunityError(error: unknown) {
  const mapped = toOpportunityErrorResponse(error) ?? toApplicationErrorResponse(error);
  if (mapped) {
    const message =
      mapped.message.includes("already exists for this job") || mapped.message.includes("Already applied")
        ? "Already applied"
        : mapped.message;
    return NextResponse.json({ message }, { status: mapped.status });
  }
  return NextResponse.json({ message: "Could not complete this request." }, { status: 500 });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
