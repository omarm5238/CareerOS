import { NextResponse } from "next/server";

import {
  getOrCreateDailyRoadmapPreference,
  handleDailyRoadmapError,
  readJsonBody,
  requireDailyRoadmapUser,
  updateDailyRoadmapPreference,
} from "@/features/daily-roadmap/server";

export async function GET() {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ preferences: await getOrCreateDailyRoadmapPreference(auth.userId) });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    const preferences = await updateDailyRoadmapPreference(auth.userId, body);
    return NextResponse.json({ preferences, message: "Preferences saved." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
