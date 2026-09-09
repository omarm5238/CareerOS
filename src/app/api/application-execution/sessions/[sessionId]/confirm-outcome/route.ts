import { NextResponse } from "next/server";

import { confirmSubmissionOutcome, getExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, readJsonBody, requireExecutionUser } from "@/features/application-execution/lib/api-handler";
import type { ConfirmOutcome } from "@/features/application-execution/types";

function parseOutcome(value: unknown): ConfirmOutcome | null {
  return value === "SUBMITTED" || value === "NOT_SUBMITTED" || value === "NOT_SURE" ? value : null;
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const { sessionId } = await context.params;
    const body = await readJsonBody(request);
    const outcome = parseOutcome(body.outcome);
    if (!outcome) {
      return NextResponse.json({ message: "Outcome must be SUBMITTED, NOT_SUBMITTED, or NOT_SURE." }, { status: 400 });
    }
    await confirmSubmissionOutcome(authResult.userId, sessionId, outcome);
    return NextResponse.json(await getExecutionSession(authResult.userId, sessionId));
  } catch (error) {
    return handleExecutionError(error);
  }
}
