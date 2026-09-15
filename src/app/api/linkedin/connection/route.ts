import { NextResponse } from "next/server";

import { getSafeLinkedinConnection, handleLinkedinError, requireLinkedinUser } from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const connection = await getSafeLinkedinConnection(auth.userId);
    return NextResponse.json(connection);
  } catch (error) {
    return handleLinkedinError(error);
  }
}
