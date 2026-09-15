import { NextResponse } from "next/server";

import { getLinkedinPublishingAttempt, handleLinkedinError, requireLinkedinUser } from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { attemptId } = await context.params;
    return NextResponse.json(await getLinkedinPublishingAttempt(auth.userId, attemptId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
