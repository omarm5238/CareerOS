import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { skipOpportunity } from "@/features/application-packages/server";

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    return NextResponse.json(
      await skipOpportunity(authResult.userId, {
        packageId: typeof body.packageId === "string" ? body.packageId : undefined,
        jobPostingId: typeof body.jobPostingId === "string" ? body.jobPostingId : undefined,
      }),
    );
  } catch (error) {
    return handleOpportunityError(error);
  }
}
