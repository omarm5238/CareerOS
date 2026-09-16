import { NextResponse } from "next/server";

import {
  createCustomCareerAction,
  handleDailyRoadmapError,
  readJsonBody,
  requireDailyRoadmapUser,
} from "@/features/daily-roadmap/server";

export async function POST(request: Request) {
  const auth = await requireDailyRoadmapUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    const action = await createCustomCareerAction(auth.userId, body);
    return NextResponse.json({ action, message: "Career action added." });
  } catch (error) {
    return handleDailyRoadmapError(error);
  }
}
