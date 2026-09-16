import { NextResponse } from "next/server";

import {
  getTodayWorkspace,
  handleDailyRoadmapError,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

export async function GET() {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getTodayWorkspace(auth.userId));
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
