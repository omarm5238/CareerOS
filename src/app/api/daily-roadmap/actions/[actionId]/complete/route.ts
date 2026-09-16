import { NextResponse } from "next/server";

import {
  completeDailyRoadmapAction,
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
    await readJsonBody(request);
    const action = await completeDailyRoadmapAction(auth.userId, actionId);
    return NextResponse.json({ action, message: "Action marked complete." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
