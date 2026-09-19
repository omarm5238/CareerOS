import { NextResponse } from "next/server";

import {
  generateWeeklyReview,
  handleWeeklyReviewError,
  readJsonBody,
  requireWeeklyReviewUser,
} from "@/features/weekly-review/server";

export async function POST(request: Request) {
  const auth = await requireWeeklyReviewUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    const review = await generateWeeklyReview(auth.userId, body);
    return NextResponse.json({ review, message: "Weekly review generated." });
  } catch (error) {
    return handleWeeklyReviewError(error);
  }
}
