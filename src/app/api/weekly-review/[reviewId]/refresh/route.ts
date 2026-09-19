import { NextResponse } from "next/server";

import {
  handleWeeklyReviewError,
  refreshWeeklyReview,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    const { reviewId } = await context.params;
    const review = await refreshWeeklyReview(auth.userId, reviewId);
    return NextResponse.json({ review, message: "Weekly review refreshed." });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
