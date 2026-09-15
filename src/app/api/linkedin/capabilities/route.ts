import { NextResponse } from "next/server";

import { getLinkedinCapabilities, handleLinkedinError, requireLinkedinUser } from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getLinkedinCapabilities(auth.userId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
