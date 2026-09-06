import { NextResponse } from "next/server";

import { handleOpportunityError, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { approveApplicationPackage } from "@/features/application-packages/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { packageId } = await context.params;
    return NextResponse.json(await approveApplicationPackage(authResult.userId, packageId));
  } catch (error) {
    return handleOpportunityError(error);
  }
}
