import { NextResponse } from "next/server";

import {
  generateTodayRoadmap,
  handleDailyRoadmapError,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

export async function POST() {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const roadmap = await generateTodayRoadmap(auth.userId);
    return NextResponse.json({ roadmap, message: "Today's roadmap is ready." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
