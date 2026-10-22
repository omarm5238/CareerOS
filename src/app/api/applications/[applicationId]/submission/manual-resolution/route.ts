import { NextResponse } from "next/server";

import { resolveSubmissionManually } from "@/features/application-execution/integrity/external-submission";
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
  const resolution = body.resolution === "CONFIRMED_SUBMITTED" || body.resolution === "CONFIRMED_NOT_SUBMITTED" ? body.resolution : null;
  if (!resolution) return NextResponse.json({ message: "Resolution is required." }, { status: 400 });
  try {
    const disposition = await resolveSubmissionManually({
      userId: owned.userId,
      applicationId: owned.applicationId,
      attemptId,
      resolution,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json({ recoveryDisposition: disposition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual resolution failed.";
    return NextResponse.json({ message }, { status: 409 });
  }
}
