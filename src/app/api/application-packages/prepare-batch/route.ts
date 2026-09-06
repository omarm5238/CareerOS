import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { prepareApplicationPackageBatch } from "@/features/application-packages/server";

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const jobPostingIds = Array.isArray(body.jobPostingIds)
      ? body.jobPostingIds.filter((id): id is string => typeof id === "string")
      : undefined;
    const result = await prepareApplicationPackageBatch(authResult.userId, {
      jobPostingIds,
      limit: typeof body.limit === "number" ? body.limit : 5,
    });
    return NextResponse.json({ items: result });
  } catch (error) {
    return handleOpportunityError(error);
  }
}
