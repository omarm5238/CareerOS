import { NextResponse } from "next/server";

import {
  deferDailyRoadmapAction,
  handleDailyRoadmapError,
  readJsonBody,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

type RouteContext = { params: Promise<{ actionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const { actionId } = await context.params;
    const body = await readJsonBody(request);
    const action = await deferDailyRoadmapAction(auth.userId, actionId, body);
    return NextResponse.json({ action, message: "Action deferred." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
