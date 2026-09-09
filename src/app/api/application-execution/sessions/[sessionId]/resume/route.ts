import { NextResponse } from "next/server";

import { getExecutionSession, resumeExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId } = await context.params;
    await resumeExecutionSession(authResult.userId, sessionId);
    return NextResponse.json(await getExecutionSession(authResult.userId, sessionId));
  } catch (error) {
    return handleExecutionError(error);
  }
}
