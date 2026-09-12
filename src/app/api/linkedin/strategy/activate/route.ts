import { NextResponse } from "next/server";

import {
  activateLinkedinStrategy,
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
} from "@/features/linkedin/server";

export async function POST(request: Request) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readOptionalJsonBody(request);
    const profileId = typeof body.id === "string" ? body.id : undefined;
    return NextResponse.json(await activateLinkedinStrategy(auth.userId, profileId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
