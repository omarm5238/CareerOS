import { NextResponse } from "next/server";

import {
  handleWeeklyReviewError,
  listWeeklyReviewHistory,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function GET() {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ history: await listWeeklyReviewHistory(auth.userId) });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
