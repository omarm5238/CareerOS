import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  requireLinkedinUser,
  syncOfficialLinkedinProfileAnalytics,
} from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await syncOfficialLinkedinProfileAnalytics(auth.userId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
