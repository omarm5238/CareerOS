import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  setActiveLinkedinPostRevision,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ postId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { postId } = await context.params;
    const body = await readOptionalJsonBody(request);
    const revisionId = typeof body.revisionId === "string" ? body.revisionId : "";
    return NextResponse.json(await setActiveLinkedinPostRevision(auth.userId, postId, revisionId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
