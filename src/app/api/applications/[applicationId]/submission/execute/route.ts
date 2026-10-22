import { NextResponse } from "next/server";

import { evaluateLiveSubmitGate, liveProviderInvocationCount } from "@/features/application-execution/integrity/live-submit-policy";
import { readJson, rejectClientTarget, requireOwnedApplication } from "@/features/application-execution/integrity/submission-request";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { applicationId } = await context.params;
  const owned = await requireOwnedApplication(applicationId);
  if ("response" in owned) return owned.response;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const rejected = rejectClientTarget(body);
  if (rejected) return rejected;

  const authorizationId = typeof body.authorizationId === "string" ? body.authorizationId : "";
  const authorization = await prisma.applicationSubmitAuthorization.findFirst({
    where: { id: authorizationId, userId: owned.userId, applicationId: owned.applicationId },
  });
  if (!authorization) return NextResponse.json({ message: "AUTHORIZATION_MISSING" }, { status: 404 });
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: authorization.attemptId, userId: owned.userId, applicationId: owned.applicationId },
    select: { destinationUrl: true },
  });

  const before = liveProviderInvocationCount();
  const gate = evaluateLiveSubmitGate({
    provider: authorization.provider,
    host: authorization.targetHost,
    jobId: authorization.targetJobId ?? "",
    destination: attempt?.destinationUrl ?? "",
    applicationId: authorization.applicationId,
    expectedApplicationId: owned.applicationId,
    packageId: authorization.packageId,
    expectedPackageId: authorization.packageId,
    authorizationState: authorization.state,
    authorizationExpired: authorization.expiresAt.getTime() <= Date.now(),
    dryRunStatus: authorization.dryRunStatus,
  });
  if (liveProviderInvocationCount() !== before) {
    return NextResponse.json({ message: "Live submit was invoked unexpectedly." }, { status: 500 });
  }
  if (!gate.allowed) return NextResponse.json({ message: gate.reason }, { status: 403 });
  return NextResponse.json({ message: "LIVE_ADAPTER_NOT_CONFIGURED" }, { status: 403 });
}
