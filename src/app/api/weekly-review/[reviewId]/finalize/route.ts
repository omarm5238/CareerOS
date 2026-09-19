import { NextResponse } from "next/server";

import {
  finalizeWeeklyReview,
  handleWeeklyReviewError,
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
    const review = await finalizeWeeklyReview(auth.userId, reviewId);
    return NextResponse.json({ review, message: "Weekly review finalized." });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
