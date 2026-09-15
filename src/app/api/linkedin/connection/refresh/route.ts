import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  refreshLinkedinConnectionMetadata,
  requireLinkedinUser,
} from "@/features/linkedin/server";

export async function POST() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await refreshLinkedinConnectionMetadata(auth.userId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
