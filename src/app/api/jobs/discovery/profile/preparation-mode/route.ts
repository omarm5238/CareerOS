import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { setApplicationPreparationMode } from "@/features/application-packages/server";

export async function PATCH(request: Request) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    return NextResponse.json(await setApplicationPreparationMode(authResult.userId, body.mode));
  } catch (error) {
    return handleOpportunityError(error);
  }
}
