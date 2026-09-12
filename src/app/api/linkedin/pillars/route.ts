import { NextResponse } from "next/server";

import { handleLinkedinError, listLinkedinPillars, requireLinkedinUser } from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ pillars: await listLinkedinPillars(auth.userId) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}
