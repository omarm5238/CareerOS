import { NextResponse } from "next/server";

import { disconnectLinkedinConnection, handleLinkedinError, requireLinkedinUser } from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await disconnectLinkedinConnection(auth.userId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
