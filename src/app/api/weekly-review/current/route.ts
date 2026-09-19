import { NextResponse } from "next/server";

import {
  getWeeklyReviewWorkspace,
  handleWeeklyReviewError,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function GET() {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getWeeklyReviewWorkspace(auth.userId));
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
