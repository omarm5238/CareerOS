import { NextResponse } from "next/server";

import { getSubmissionAudit } from "@/features/application-execution/integrity/external-submission";
import { requireOwnedApplication } from "@/features/application-execution/integrity/submission-request";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { applicationId } = await context.params;
  const owned = await requireOwnedApplication(applicationId);
  if ("response" in owned) return owned.response;
  const state = await getSubmissionAudit(owned.userId, owned.applicationId);
  return NextResponse.json({
    attemptId: state.attemptId,
    phase: state.phase,
    recoveryDisposition: state.recoveryDisposition,
    confirmationStrength: state.confirmationStrength,
    providerReference: state.providerReference,
    canRetry: state.canRetry,
    canVerify: state.canVerify,
    requiresManualReview: state.requiresManualReview,
  });
}
