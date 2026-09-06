import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { updateRequiredUserInput } from "@/features/application-packages/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { packageId } = await context.params;
    const result = await updateRequiredUserInput(authResult.userId, packageId, await readJsonBody(request));
    return NextResponse.json(result);
  } catch (error) {
    return handleOpportunityError(error);
  }
}
