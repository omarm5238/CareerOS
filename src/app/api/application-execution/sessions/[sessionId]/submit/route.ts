import { NextResponse } from "next/server";

import { executeConfirmedSubmit, getExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, readJsonBody, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId } = await context.params;
    const body = await readJsonBody(request);
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken : "";
    await executeConfirmedSubmit(authResult.userId, sessionId, attemptId, approvalToken);
    return NextResponse.json(await getExecutionSession(authResult.userId, sessionId));
  } catch (error) {
    return handleExecutionError(error);
  }
}
