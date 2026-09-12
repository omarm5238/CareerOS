import { NextResponse } from "next/server";

import { handleLinkedinError, listLinkedinInsights, requireLinkedinUser } from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ insights: await listLinkedinInsights(auth.userId) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}
