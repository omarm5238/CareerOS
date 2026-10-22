import { NextResponse } from "next/server";

import { issueSubmitAuthorization } from "@/features/application-execution/integrity/external-submission";
import { readJson, rejectClientTarget, requireOwnedApplication } from "@/features/application-execution/integrity/submission-request";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { applicationId } = await context.params;
  const owned = await requireOwnedApplication(applicationId);
  if ("response" in owned) return owned.response;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const rejected = rejectClientTarget(body);
  if (rejected) return rejected;
  const packageId = typeof body.packageId === "string" ? body.packageId : "";
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  const issued = await issueSubmitAuthorization(owned.userId, {
    applicationId: owned.applicationId,
    packageId,
    attemptId,
  });
  if (!issued.ok) return NextResponse.json({ message: issued.reason }, { status: 409 });
  return NextResponse.json({
    authorizationId: issued.authorizationId,
    expiresAt: issued.expiresAt.toISOString(),
    token: issued.token,
  });
}
