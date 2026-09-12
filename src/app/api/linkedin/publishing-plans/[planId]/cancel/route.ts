import { NextResponse } from "next/server";

import {
  cancelLinkedinPublishingPlan,
  handleLinkedinError,
  requireLinkedinUser,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ planId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { planId } = await context.params;
    return NextResponse.json(await cancelLinkedinPublishingPlan(auth.userId, planId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
