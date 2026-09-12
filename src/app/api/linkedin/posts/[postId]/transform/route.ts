import { NextResponse } from "next/server";

import {
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  transformLinkedinPost,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ postId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { postId } = await context.params;
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await transformLinkedinPost(auth.userId, postId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
