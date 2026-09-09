import { NextResponse } from "next/server";

import { getExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId } = await context.params;
    const session = await getExecutionSession(authResult.userId, sessionId);
    return NextResponse.json({ events: session.events });
  } catch (error) {
    return handleExecutionError(error);
  }
}
