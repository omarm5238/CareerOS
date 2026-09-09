import { NextResponse } from "next/server";

import { getExecutionSession, patchFieldAnswer } from "@/features/application-execution/server";
import { handleExecutionError, readJsonBody, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string; fieldId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId, fieldId } = await context.params;
    const body = await readJsonBody(request);
    await patchFieldAnswer(authResult.userId, sessionId, decodeURIComponent(fieldId), {
      value: body.value,
      confirmed: body.confirmed === true,
      savePreference: body.savePreference === true,
      reviewed: body.reviewed === true,
    });
    return NextResponse.json(await getExecutionSession(authResult.userId, sessionId));
  } catch (error) {
    return handleExecutionError(error);
  }
}
