import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  resolveLinkedinPublishingAttempt,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { attemptId } = await context.params;
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await resolveLinkedinPublishingAttempt(auth.userId, attemptId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
