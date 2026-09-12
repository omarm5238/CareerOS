import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  updateLinkedinPublishingPlan,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ planId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { planId } = await context.params;
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await updateLinkedinPublishingPlan(auth.userId, planId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
