import { NextResponse } from "next/server";

import { handleLinkedinError, refreshLinkedinStrategy, requireLinkedinUser } from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await refreshLinkedinStrategy(auth.userId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
