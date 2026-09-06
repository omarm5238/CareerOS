import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { prepareApplicationPackage } from "@/features/application-packages/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobPostingId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { jobPostingId } = await context.params;
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const result = await prepareApplicationPackage(authResult.userId, jobPostingId, {
      forceNewPackage: body.forceNewPackage === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleOpportunityError(error);
  }
}
