import { NextResponse } from "next/server";

import {
  dismissWeeklyRecommendation,
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
    const review = await dismissWeeklyRecommendation(auth.userId, recommendationId, body);
    return NextResponse.json({ review, message: "Recommendation dismissed." });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
