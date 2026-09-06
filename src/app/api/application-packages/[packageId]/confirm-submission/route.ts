import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { confirmExternalSubmission } from "@/features/application-packages/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { packageId } = await context.params;
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    return NextResponse.json(await confirmExternalSubmission(authResult.userId, packageId, body.outcome));
  } catch (error) {
    return handleOpportunityError(error);
  }
}
