import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  updateContentPillar,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ pillarId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { pillarId } = await context.params;
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await updateContentPillar(auth.userId, pillarId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
