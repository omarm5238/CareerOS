import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  updateLinkedinIdea,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ ideaId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { ideaId } = await context.params;
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await updateLinkedinIdea(auth.userId, ideaId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
