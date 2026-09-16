import { NextResponse } from "next/server";

import {
  handleDailyRoadmapError,
  refreshTodayRoadmap,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

export async function POST() {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const roadmap = await refreshTodayRoadmap(auth.userId);
    return NextResponse.json({ roadmap, message: "Today was refreshed without replacing your history." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
