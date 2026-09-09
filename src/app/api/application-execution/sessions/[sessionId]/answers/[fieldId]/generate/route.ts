import { NextResponse } from "next/server";

import { generateFieldAnswer, getExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string; fieldId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId, fieldId } = await context.params;
    const generated = await generateFieldAnswer(authResult.userId, sessionId, decodeURIComponent(fieldId));
    const session = await getExecutionSession(authResult.userId, sessionId);
    return NextResponse.json({ ...session, generated });
  } catch (error) {
    return handleExecutionError(error);
  }
}
