import { NextResponse } from "next/server";

import {
  calculateCareerStreak,
  handleDailyRoadmapError,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

export async function GET() {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ streak: await calculateCareerStreak(auth.userId) });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
