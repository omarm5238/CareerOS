import { NextResponse } from "next/server";

import {
  getWeeklyReviewById,
  handleWeeklyReviewError,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    const { reviewId } = await context.params;
    return NextResponse.json({ review: await getWeeklyReviewById(auth.userId, reviewId) });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
