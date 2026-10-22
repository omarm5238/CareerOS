import { NextResponse } from "next/server";

import { issueRetryAuthorization } from "@/features/application-execution/integrity/external-submission";
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
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  const issued = await issueRetryAuthorization(owned.userId, attemptId);
  if (!issued.ok) return NextResponse.json({ message: issued.reason }, { status: 409 });
  return NextResponse.json({
    attemptId: issued.attemptId,
    authorizationId: issued.authorizationId,
  });
}
