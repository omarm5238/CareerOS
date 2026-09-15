import { NextResponse } from "next/server";

import { handleLinkedinError, requireLinkedinUser, startLinkedinConnection } from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await startLinkedinConnection(auth.userId, "connect"));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
