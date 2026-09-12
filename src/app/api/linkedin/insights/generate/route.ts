import { NextResponse } from "next/server";

import {
  generateLinkedinGrowthInsights,
  handleLinkedinError,
  requireLinkedinUser,
} from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ insights: await generateLinkedinGrowthInsights(auth.userId) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}
