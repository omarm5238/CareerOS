import { NextResponse } from "next/server";

import {
  getOwnedAction,
  handleDailyRoadmapError,
  requireDailyRoadmapUser,
  toActionView,
} from "@/features/daily-roadmap/server";

type RouteContext = { params: Promise<{ actionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const { actionId } = await context.params;
    const action = await getOwnedAction(auth.userId, actionId);
    return NextResponse.json({ action: toActionView(action) });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
