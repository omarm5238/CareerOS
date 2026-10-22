import { NextResponse } from "next/server";

import { recoverExternalSubmission } from "@/features/application-execution/integrity/external-submission";
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
  try {
    const disposition = await recoverExternalSubmission(owned.userId, attemptId);
    return NextResponse.json({ recoveryDisposition: disposition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recovery failed.";
    return NextResponse.json({ message }, { status: 409 });
  }
}
