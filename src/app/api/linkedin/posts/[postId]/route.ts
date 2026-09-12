import { NextResponse } from "next/server";

import { getLinkedinPost, handleLinkedinError, requireLinkedinUser } from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { postId } = await context.params;
    return NextResponse.json(await getLinkedinPost(auth.userId, postId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
