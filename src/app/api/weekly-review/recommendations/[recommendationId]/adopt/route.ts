import { NextResponse } from "next/server";

import {
  adoptWeeklyRecommendation,
  handleWeeklyReviewError,
  readJsonBody,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ recommendationId: string }> },
) {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    const { recommendationId } = await context.params;
    const body = await readJsonBody(request);
    const review = await adoptWeeklyRecommendation(auth.userId, recommendationId, body);
    return NextResponse.json({ review, message: "Adopted for next-week focus." });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
